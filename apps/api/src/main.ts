import * as dotenv from "dotenv";
import * as path from "path";

// Load env vars early — covers both CWD=apps/api/ and CWD=monorepo-root
dotenv.config(); // loads CWD/.env
dotenv.config({ path: path.resolve(process.cwd(), "apps/api/.env") });

import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import * as express from "express";
import { AppModule } from "./app.module";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";
import { TransformInterceptor } from "./common/interceptors/transform.interceptor";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log", "debug"],
  });

  // Increase body size limit for bulk imports (834+ tests)
  app.use(express.json({ limit: "20mb" }));
  app.use(express.urlencoded({ extended: true, limit: "20mb" }));

  // Global prefix
  app.setGlobalPrefix("api/v1");

  // CORS
  app.enableCors({
    origin: process.env["ALLOWED_ORIGINS"]?.split(",") ?? [
      "http://localhost:3000",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    })
  );

  // Global filters
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Global interceptors
  app.useGlobalInterceptors(new TransformInterceptor());

  // Swagger
  if (process.env["NODE_ENV"] !== "production") {
    const config = new DocumentBuilder()
      .setTitle("DELViON Health API")
      .setDescription("Global Diagnostic SaaS Platform API")
      .setVersion("1.0")
      .addBearerAuth()
      .addTag("auth", "Authentication & Authorization")
      .addTag("tenants", "Tenant Management")
      .addTag("users", "User Management")
      .addTag("patients", "Patient Registry")
      .addTag("orders", "Order Management")
      .addTag("samples", "Sample Tracking")
      .addTag("results", "Test Results")
      .addTag("reports", "Lab Reports")
      .addTag("billing", "Billing & Payments")
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup("api/docs", app, document);
  }

  const port = process.env["PORT"] ?? 3001;
  await app.listen(port);
  console.warn(`DELViON Health API running on: http://localhost:${port}/api/v1`);
  console.warn(`Swagger docs: http://localhost:${port}/api/docs`);
  console.warn(`ANTHROPIC_API_KEY loaded: ${!!process.env.ANTHROPIC_API_KEY}`);
}

void bootstrap();

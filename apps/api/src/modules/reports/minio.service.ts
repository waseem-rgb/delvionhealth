import { Injectable, OnModuleInit, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as Minio from "minio";

const BUCKET = "delvion-reports";

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private client!: Minio.Client;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    this.client = new Minio.Client({
      endPoint: this.config.get<string>("MINIO_ENDPOINT", "localhost"),
      port: this.config.get<number>("MINIO_PORT", 9000),
      useSSL: false,
      accessKey: this.config.get<string>("MINIO_ACCESS_KEY", "delvion_minio"),
      secretKey: this.config.get<string>("MINIO_SECRET_KEY", "delvion_minio_secret"),
    });

    try {
      const exists = await this.client.bucketExists(BUCKET);
      if (!exists) {
        await this.client.makeBucket(BUCKET, "us-east-1");
        this.logger.log(`Bucket '${BUCKET}' created`);
      }
    } catch (err) {
      this.logger.warn(`MinIO init warning: ${String(err)}`);
    }
  }

  async upload(
    objectKey: string,
    buffer: Buffer,
    contentType: string
  ): Promise<void> {
    await this.client.putObject(BUCKET, objectKey, buffer, buffer.length, {
      "Content-Type": contentType,
    });
  }

  async getPresignedUrl(objectKey: string, expirySeconds = 3600): Promise<string> {
    return this.client.presignedGetObject(BUCKET, objectKey, expirySeconds);
  }

  async deleteObject(objectKey: string): Promise<void> {
    await this.client.removeObject(BUCKET, objectKey);
  }
}

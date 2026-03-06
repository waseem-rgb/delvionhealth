import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { OrdersService } from "./orders.service";
import { StandingOrdersService } from "./standing-orders.service";
import { CreateOrderDto } from "./dto/create-order.dto";
import { UpdateOrderStatusDto } from "./dto/update-order-status.dto";
import { QueryOrderDto } from "./dto/query-order.dto";
import { ApplyDiscountDto } from "./dto/apply-discount.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role } from "@delvion/types";
import type { JwtPayload } from "@delvion/types";

@ApiTags("orders")
@ApiBearerAuth()
@Controller("orders")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly standingOrdersService: StandingOrdersService
  ) {}

  // POST /orders
  @Post()
  @Roles(
    Role.SUPER_ADMIN,
    Role.TENANT_ADMIN,
    Role.LAB_MANAGER,
    Role.FRONT_DESK
  )
  @ApiOperation({ summary: "Create a new order" })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(user.tenantId, user.sub, dto);
  }

  // GET /orders
  @Get()
  @ApiOperation({ summary: "List orders with filters and pagination" })
  findAll(@CurrentUser() user: JwtPayload, @Query() query: QueryOrderDto) {
    return this.ordersService.findAll(user.tenantId, query);
  }

  // GET /orders/search?q=
  @Get("search")
  @ApiOperation({ summary: "Quick order search (CommandPalette)" })
  @ApiQuery({ name: "q", required: true })
  search(
    @CurrentUser() user: JwtPayload,
    @Query("q") q: string
  ) {
    return this.ordersService.search(user.tenantId, q ?? "");
  }

  // GET /orders/standing
  @Get("standing")
  @ApiOperation({ summary: "List all standing orders" })
  findAllStanding(@CurrentUser() user: JwtPayload) {
    return this.standingOrdersService.findAll(user.tenantId);
  }

  // POST /orders/standing
  @Post("standing")
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER, Role.FRONT_DESK)
  @ApiOperation({ summary: "Create a standing order" })
  createStanding(
    @CurrentUser() user: JwtPayload,
    @Body() dto: { patientId: string; testCatalogIds: string[]; frequency: string; nextRunAt?: string }
  ) {
    return this.standingOrdersService.create(dto, user.tenantId, user.sub);
  }

  // PUT /orders/standing/:id
  @Put("standing/:id")
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER, Role.FRONT_DESK)
  @ApiOperation({ summary: "Update a standing order" })
  updateStanding(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: { frequency?: string; testCatalogIds?: string[]; nextRunAt?: string }
  ) {
    return this.standingOrdersService.update(id, dto, user.tenantId);
  }

  // DELETE /orders/standing/:id
  @Delete("standing/:id")
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Deactivate a standing order" })
  deactivateStanding(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string
  ) {
    return this.standingOrdersService.deactivate(id, user.tenantId);
  }

  // GET /orders/catalog — test catalog with org-aware pricing
  @Get("catalog")
  @ApiOperation({ summary: "Test catalog with org-specific pricing for registration" })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "category", required: false })
  @ApiQuery({ name: "orgId", required: false })
  getTestCatalog(
    @CurrentUser() user: JwtPayload,
    @Query("search") search?: string,
    @Query("category") category?: string,
    @Query("orgId") orgId?: string,
  ) {
    return this.ordersService.getTestCatalog(user.tenantId, search, category, orgId);
  }

  // GET /orders/:id
  @Get(":id")
  @ApiOperation({ summary: "Get order details" })
  findOne(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.ordersService.findOne(user.tenantId, id);
  }

  // PUT /orders/:id/status
  @Put(":id/status")
  @Roles(
    Role.SUPER_ADMIN,
    Role.TENANT_ADMIN,
    Role.LAB_MANAGER,
    Role.LAB_TECHNICIAN,
    Role.FRONT_DESK
  )
  @ApiOperation({ summary: "Update order status (state machine enforced)" })
  updateStatus(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: UpdateOrderStatusDto
  ) {
    return this.ordersService.updateStatus(user.tenantId, id, dto, user.sub);
  }

  // POST /orders/:id/items
  @Post(":id/items")
  @Roles(
    Role.SUPER_ADMIN,
    Role.TENANT_ADMIN,
    Role.LAB_MANAGER,
    Role.FRONT_DESK
  )
  @ApiOperation({ summary: "Add a test item to a PENDING/CONFIRMED order" })
  addItem(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() body: { testCatalogId: string; quantity?: number; discount?: number }
  ) {
    return this.ordersService.addItem(user.tenantId, id, body, user.sub);
  }

  // DELETE /orders/:id/items/:itemId
  @Delete(":id/items/:itemId")
  @Roles(
    Role.SUPER_ADMIN,
    Role.TENANT_ADMIN,
    Role.LAB_MANAGER,
    Role.FRONT_DESK
  )
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Remove a test item from a PENDING/CONFIRMED order" })
  removeItem(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Param("itemId") itemId: string
  ) {
    return this.ordersService.removeItem(user.tenantId, id, itemId, user.sub);
  }

  // POST /orders/:id/discount
  @Post(":id/discount")
  @Roles(
    Role.SUPER_ADMIN,
    Role.TENANT_ADMIN,
    Role.LAB_MANAGER
  )
  @ApiOperation({ summary: "Apply an order-level discount" })
  applyDiscount(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: ApplyDiscountDto
  ) {
    return this.ordersService.applyDiscount(user.tenantId, id, dto, user.sub);
  }

  // DELETE /orders/:id
  @Delete(":id")
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Cancel an order (PENDING/CONFIRMED only)" })
  cancel(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.ordersService.cancel(user.tenantId, id, user.sub);
  }
}

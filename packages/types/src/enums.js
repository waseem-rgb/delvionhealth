"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApprovalStatus = exports.B2BInvoiceStatus = exports.OutsourceStatus = exports.DispatchChannel = exports.DispatchStatus = exports.ReportApprovalStatus = exports.GLAccountType = exports.POStatus = exports.AppointmentStatus = exports.AppointmentType = exports.LeadStatus = exports.LeadSource = exports.ClaimStatus = exports.NoteType = exports.PaymentStatus = exports.PaymentMethod = exports.InvoiceStatus = exports.ReportStatus = exports.ResultInterpretation = exports.CollectionType = exports.SampleRejectionReason = exports.SampleStatus = exports.OrderStatus = exports.Role = void 0;
var Role;
(function (Role) {
    Role["SUPER_ADMIN"] = "SUPER_ADMIN";
    Role["TENANT_ADMIN"] = "TENANT_ADMIN";
    Role["LAB_MANAGER"] = "LAB_MANAGER";
    Role["PATHOLOGIST"] = "PATHOLOGIST";
    Role["LAB_TECHNICIAN"] = "LAB_TECHNICIAN";
    Role["FRONT_DESK"] = "FRONT_DESK";
    Role["PHLEBOTOMIST"] = "PHLEBOTOMIST";
    Role["FIELD_SALES_REP"] = "FIELD_SALES_REP";
    Role["FINANCE_EXECUTIVE"] = "FINANCE_EXECUTIVE";
    Role["HR_MANAGER"] = "HR_MANAGER";
    Role["PROCUREMENT_MANAGER"] = "PROCUREMENT_MANAGER";
    Role["DOCTOR"] = "DOCTOR";
    Role["PATIENT"] = "PATIENT";
    Role["CORPORATE_CLIENT"] = "CORPORATE_CLIENT";
    Role["IT_ADMIN"] = "IT_ADMIN";
})(Role || (exports.Role = Role = {}));
var OrderStatus;
(function (OrderStatus) {
    OrderStatus["DRAFT"] = "DRAFT";
    OrderStatus["PENDING"] = "PENDING";
    OrderStatus["CONFIRMED"] = "CONFIRMED";
    OrderStatus["PENDING_COLLECTION"] = "PENDING_COLLECTION";
    OrderStatus["SAMPLE_COLLECTED"] = "SAMPLE_COLLECTED";
    OrderStatus["RECEIVED"] = "RECEIVED";
    OrderStatus["SAMPLE_REJECTED"] = "SAMPLE_REJECTED";
    OrderStatus["PENDING_PROCESSING"] = "PENDING_PROCESSING";
    OrderStatus["IN_PROCESSING"] = "IN_PROCESSING";
    OrderStatus["PENDING_APPROVAL"] = "PENDING_APPROVAL";
    OrderStatus["RESULTED"] = "RESULTED";
    OrderStatus["APPROVED"] = "APPROVED";
    OrderStatus["REPORTED"] = "REPORTED";
    OrderStatus["DISPATCHED"] = "DISPATCHED";
    OrderStatus["DELIVERED"] = "DELIVERED";
    OrderStatus["ARCHIVED"] = "ARCHIVED";
    OrderStatus["CANCELLED"] = "CANCELLED";
})(OrderStatus || (exports.OrderStatus = OrderStatus = {}));
var SampleRejectionReason;
(function (SampleRejectionReason) {
    SampleRejectionReason["HEMOLYZED"] = "HEMOLYZED";
    SampleRejectionReason["INSUFFICIENT_QUANTITY"] = "INSUFFICIENT_QUANTITY";
    SampleRejectionReason["WRONG_TUBE"] = "WRONG_TUBE";
    SampleRejectionReason["UNLABELED"] = "UNLABELED";
    SampleRejectionReason["MISLABELED"] = "MISLABELED";
    SampleRejectionReason["CLOTTED"] = "CLOTTED";
    SampleRejectionReason["LEAKED"] = "LEAKED";
    SampleRejectionReason["CONTAMINATED"] = "CONTAMINATED";
    SampleRejectionReason["EXPIRED"] = "EXPIRED";
    SampleRejectionReason["OTHER"] = "OTHER";
})(SampleRejectionReason || (exports.SampleRejectionReason = SampleRejectionReason = {}));
var CollectionType;
(function (CollectionType) {
    CollectionType["WALK_IN"] = "WALK_IN";
    CollectionType["HOME_COLLECTION"] = "HOME_COLLECTION";
    CollectionType["B2B"] = "B2B";
    CollectionType["CAMP"] = "CAMP";
    CollectionType["OUTSOURCE_RECEIVED"] = "OUTSOURCE_RECEIVED";
})(CollectionType || (exports.CollectionType = CollectionType = {}));
var SampleStatus;
(function (SampleStatus) {
    SampleStatus["PENDING_COLLECTION"] = "PENDING_COLLECTION";
    SampleStatus["COLLECTED"] = "COLLECTED";
    SampleStatus["IN_TRANSIT"] = "IN_TRANSIT";
    SampleStatus["RECEIVED"] = "RECEIVED";
    SampleStatus["PROCESSING"] = "PROCESSING";
    SampleStatus["STORED"] = "STORED";
    SampleStatus["REJECTED"] = "REJECTED";
    SampleStatus["DISPOSED"] = "DISPOSED";
})(SampleStatus || (exports.SampleStatus = SampleStatus = {}));
var ResultInterpretation;
(function (ResultInterpretation) {
    ResultInterpretation["NORMAL"] = "NORMAL";
    ResultInterpretation["ABNORMAL"] = "ABNORMAL";
    ResultInterpretation["CRITICAL"] = "CRITICAL";
    ResultInterpretation["INCONCLUSIVE"] = "INCONCLUSIVE";
})(ResultInterpretation || (exports.ResultInterpretation = ResultInterpretation = {}));
var ReportStatus;
(function (ReportStatus) {
    ReportStatus["GENERATED"] = "GENERATED";
    ReportStatus["DRAFT"] = "DRAFT";
    ReportStatus["PENDING_REVIEW"] = "PENDING_REVIEW";
    ReportStatus["SIGNED"] = "SIGNED";
    ReportStatus["DELIVERED"] = "DELIVERED";
    ReportStatus["AMENDED"] = "AMENDED";
})(ReportStatus || (exports.ReportStatus = ReportStatus = {}));
var InvoiceStatus;
(function (InvoiceStatus) {
    InvoiceStatus["DRAFT"] = "DRAFT";
    InvoiceStatus["SENT"] = "SENT";
    InvoiceStatus["PAID"] = "PAID";
    InvoiceStatus["PARTIALLY_PAID"] = "PARTIALLY_PAID";
    InvoiceStatus["OVERDUE"] = "OVERDUE";
    InvoiceStatus["CANCELLED"] = "CANCELLED";
})(InvoiceStatus || (exports.InvoiceStatus = InvoiceStatus = {}));
var PaymentMethod;
(function (PaymentMethod) {
    PaymentMethod["CASH"] = "CASH";
    PaymentMethod["CARD"] = "CARD";
    PaymentMethod["UPI"] = "UPI";
    PaymentMethod["WALLET"] = "WALLET";
    PaymentMethod["INSURANCE"] = "INSURANCE";
    PaymentMethod["BANK_TRANSFER"] = "BANK_TRANSFER";
    PaymentMethod["CREDIT"] = "CREDIT";
})(PaymentMethod || (exports.PaymentMethod = PaymentMethod = {}));
var PaymentStatus;
(function (PaymentStatus) {
    PaymentStatus["PENDING"] = "PENDING";
    PaymentStatus["COMPLETED"] = "COMPLETED";
    PaymentStatus["FAILED"] = "FAILED";
    PaymentStatus["REFUNDED"] = "REFUNDED";
})(PaymentStatus || (exports.PaymentStatus = PaymentStatus = {}));
var NoteType;
(function (NoteType) {
    NoteType["CALL"] = "CALL";
    NoteType["EMAIL"] = "EMAIL";
    NoteType["MEETING"] = "MEETING";
    NoteType["NOTE"] = "NOTE";
})(NoteType || (exports.NoteType = NoteType = {}));
var ClaimStatus;
(function (ClaimStatus) {
    ClaimStatus["DRAFT"] = "DRAFT";
    ClaimStatus["SUBMITTED"] = "SUBMITTED";
    ClaimStatus["PENDING"] = "PENDING";
    ClaimStatus["APPROVED"] = "APPROVED";
    ClaimStatus["REJECTED"] = "REJECTED";
    ClaimStatus["APPEALED"] = "APPEALED";
    ClaimStatus["SETTLED"] = "SETTLED";
})(ClaimStatus || (exports.ClaimStatus = ClaimStatus = {}));
var LeadSource;
(function (LeadSource) {
    LeadSource["WEBSITE"] = "WEBSITE";
    LeadSource["WHATSAPP"] = "WHATSAPP";
    LeadSource["CALL_CENTER"] = "CALL_CENTER";
    LeadSource["FIELD_REP"] = "FIELD_REP";
    LeadSource["HOSPITAL"] = "HOSPITAL";
    LeadSource["CAMPAIGN"] = "CAMPAIGN";
    LeadSource["REFERRAL"] = "REFERRAL";
})(LeadSource || (exports.LeadSource = LeadSource = {}));
var LeadStatus;
(function (LeadStatus) {
    LeadStatus["NEW"] = "NEW";
    LeadStatus["QUALIFIED"] = "QUALIFIED";
    LeadStatus["PROPOSAL"] = "PROPOSAL";
    LeadStatus["NEGOTIATION"] = "NEGOTIATION";
    LeadStatus["WON"] = "WON";
    LeadStatus["LOST"] = "LOST";
})(LeadStatus || (exports.LeadStatus = LeadStatus = {}));
var AppointmentType;
(function (AppointmentType) {
    AppointmentType["HOME_COLLECTION"] = "HOME_COLLECTION";
    AppointmentType["WALK_IN"] = "WALK_IN";
    AppointmentType["CORPORATE"] = "CORPORATE";
})(AppointmentType || (exports.AppointmentType = AppointmentType = {}));
var AppointmentStatus;
(function (AppointmentStatus) {
    AppointmentStatus["SCHEDULED"] = "SCHEDULED";
    AppointmentStatus["CONFIRMED"] = "CONFIRMED";
    AppointmentStatus["EN_ROUTE"] = "EN_ROUTE";
    AppointmentStatus["COLLECTED"] = "COLLECTED";
    AppointmentStatus["CANCELLED"] = "CANCELLED";
    AppointmentStatus["NO_SHOW"] = "NO_SHOW";
})(AppointmentStatus || (exports.AppointmentStatus = AppointmentStatus = {}));
var POStatus;
(function (POStatus) {
    POStatus["DRAFT"] = "DRAFT";
    POStatus["SENT"] = "SENT";
    POStatus["CONFIRMED"] = "CONFIRMED";
    POStatus["PARTIALLY_RECEIVED"] = "PARTIALLY_RECEIVED";
    POStatus["RECEIVED"] = "RECEIVED";
    POStatus["CANCELLED"] = "CANCELLED";
})(POStatus || (exports.POStatus = POStatus = {}));
var GLAccountType;
(function (GLAccountType) {
    GLAccountType["ASSET"] = "ASSET";
    GLAccountType["LIABILITY"] = "LIABILITY";
    GLAccountType["EQUITY"] = "EQUITY";
    GLAccountType["REVENUE"] = "REVENUE";
    GLAccountType["EXPENSE"] = "EXPENSE";
})(GLAccountType || (exports.GLAccountType = GLAccountType = {}));
var ReportApprovalStatus;
(function (ReportApprovalStatus) {
    ReportApprovalStatus["PENDING"] = "PENDING";
    ReportApprovalStatus["APPROVED"] = "APPROVED";
    ReportApprovalStatus["REJECTED"] = "REJECTED";
    ReportApprovalStatus["AUTO_APPROVED"] = "AUTO_APPROVED";
})(ReportApprovalStatus || (exports.ReportApprovalStatus = ReportApprovalStatus = {}));
var DispatchStatus;
(function (DispatchStatus) {
    DispatchStatus["NOT_SENT"] = "NOT_SENT";
    DispatchStatus["SENT"] = "SENT";
    DispatchStatus["DELIVERED"] = "DELIVERED";
    DispatchStatus["FAILED"] = "FAILED";
})(DispatchStatus || (exports.DispatchStatus = DispatchStatus = {}));
var DispatchChannel;
(function (DispatchChannel) {
    DispatchChannel["EMAIL"] = "EMAIL";
    DispatchChannel["SMS"] = "SMS";
    DispatchChannel["WHATSAPP"] = "WHATSAPP";
})(DispatchChannel || (exports.DispatchChannel = DispatchChannel = {}));
var OutsourceStatus;
(function (OutsourceStatus) {
    OutsourceStatus["PENDING_DISPATCH"] = "PENDING_DISPATCH";
    OutsourceStatus["DISPATCHED"] = "DISPATCHED";
    OutsourceStatus["RECEIVED_BY_REFLAB"] = "RECEIVED_BY_REFLAB";
    OutsourceStatus["RESULTS_PENDING"] = "RESULTS_PENDING";
    OutsourceStatus["RESULTS_RECEIVED"] = "RESULTS_RECEIVED";
    OutsourceStatus["COMPLETED"] = "COMPLETED";
    OutsourceStatus["CANCELLED"] = "CANCELLED";
})(OutsourceStatus || (exports.OutsourceStatus = OutsourceStatus = {}));
var B2BInvoiceStatus;
(function (B2BInvoiceStatus) {
    B2BInvoiceStatus["B2B_DRAFT"] = "B2B_DRAFT";
    B2BInvoiceStatus["B2B_SENT"] = "B2B_SENT";
    B2BInvoiceStatus["B2B_PARTIAL"] = "B2B_PARTIAL";
    B2BInvoiceStatus["B2B_PAID"] = "B2B_PAID";
    B2BInvoiceStatus["B2B_OVERDUE"] = "B2B_OVERDUE";
    B2BInvoiceStatus["B2B_CANCELLED"] = "B2B_CANCELLED";
})(B2BInvoiceStatus || (exports.B2BInvoiceStatus = B2BInvoiceStatus = {}));
var ApprovalStatus;
(function (ApprovalStatus) {
    ApprovalStatus["APPROVAL_PENDING"] = "APPROVAL_PENDING";
    ApprovalStatus["APPROVAL_APPROVED"] = "APPROVAL_APPROVED";
    ApprovalStatus["APPROVAL_REJECTED"] = "APPROVAL_REJECTED";
})(ApprovalStatus || (exports.ApprovalStatus = ApprovalStatus = {}));
//# sourceMappingURL=enums.js.map
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  Loader2,
  User,
  Phone,
  FileText,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { useTenantStore } from "@/store/tenantStore";

const schema = z.object({
  firstName: z.string().min(1, "Required").max(100),
  lastName: z.string().min(1, "Required").max(100),
  dob: z.string().min(1, "Required"),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]),
  phone: z.string().min(10, "Must be at least 10 digits"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  address: z.string().optional(),
  insuranceId: z.string().optional(),
  referringDoctorId: z.string().optional(),
  branchId: z.string().min(1, "Branch is required"),
});

type FormData = z.infer<typeof schema>;

const inputCls =
  "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/20 focus:border-[#1B4F8A] bg-white transition";

export default function NewPatientPage() {
  const router = useRouter();
  const { activeBranch } = useTenantStore();
  const [mrnPreview, setMrnPreview] = useState<string>("");
  const [insuranceOpen, setInsuranceOpen] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      gender: "MALE",
      branchId: activeBranch?.id ?? "",
    },
  });

  // Fetch MRN preview
  useEffect(() => {
    api
      .get<{ data: string }>("/patients/mrn/preview")
      .then((r) => setMrnPreview(r.data.data))
      .catch(() => {});
  }, []);

  const onSubmit = async (data: FormData) => {
    try {
      const res = await api.post<{ data: { id: string } }>("/patients", data);
      toast.success("Patient registered successfully");
      router.push(`/patients/${res.data.data.id}`);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to register patient";
      toast.error(msg);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5 animate-fade-in">
      {/* Page header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">Register New Patient</h1>
          <p className="text-sm text-slate-500 mt-0.5">Add a new patient to the registry</p>
        </div>
        {mrnPreview && (
          <div className="text-right">
            <p className="text-xs text-slate-400 uppercase tracking-wide">Next MRN</p>
            <p className="font-mono font-semibold text-[#1B4F8A] text-sm">{mrnPreview}</p>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Section 1: Personal Information */}
        <div className="bg-white rounded-xl card-shadow p-6">
          <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-100">
            <div className="p-2 bg-[#1B4F8A]/10 rounded-lg">
              <User size={18} className="text-[#1B4F8A]" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Personal Information</h3>
              <p className="text-xs text-slate-500 mt-0.5">Basic demographics</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                First Name <span className="text-red-500">*</span>
              </label>
              <input {...register("firstName")} placeholder="Aisha" className={inputCls} />
              {errors.firstName && (
                <p className="mt-1 text-xs text-red-500">{errors.firstName.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Last Name <span className="text-red-500">*</span>
              </label>
              <input {...register("lastName")} placeholder="Khan" className={inputCls} />
              {errors.lastName && (
                <p className="mt-1 text-xs text-red-500">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Date of Birth <span className="text-red-500">*</span>
              </label>
              <input
                {...register("dob")}
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                className={inputCls}
              />
              {errors.dob && (
                <p className="mt-1 text-xs text-red-500">{errors.dob.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Gender <span className="text-red-500">*</span>
              </label>
              <select {...register("gender")} className={inputCls}>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other / Prefer not to say</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: Contact Details */}
        <div className="bg-white rounded-xl card-shadow p-6">
          <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-100">
            <div className="p-2 bg-[#1B4F8A]/10 rounded-lg">
              <Phone size={18} className="text-[#1B4F8A]" />
            </div>
            <h3 className="font-semibold text-slate-900">Contact Details</h3>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Mobile Phone <span className="text-red-500">*</span>
              </label>
              <input
                {...register("phone")}
                type="tel"
                placeholder="+919876543210"
                className={inputCls}
              />
              {errors.phone && (
                <p className="mt-1 text-xs text-red-500">{errors.phone.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Email Address
              </label>
              <input
                {...register("email")}
                type="email"
                placeholder="patient@email.com"
                className={inputCls}
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
              )}
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Address</label>
            <textarea
              {...register("address")}
              rows={2}
              placeholder="Street, City, State, PIN..."
              className={`${inputCls} resize-none`}
            />
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Branch <span className="text-red-500">*</span>
            </label>
            <input
              {...register("branchId")}
              placeholder="Branch ID"
              className={inputCls}
              readOnly={!!activeBranch?.id}
            />
            {activeBranch && (
              <p className="mt-1 text-xs text-slate-400">
                {activeBranch.name}
              </p>
            )}
            {errors.branchId && (
              <p className="mt-1 text-xs text-red-500">{errors.branchId.message}</p>
            )}
          </div>
        </div>

        {/* Section 3: Insurance & Referral (collapsible) */}
        <div className="bg-white rounded-xl card-shadow p-6">
          <button
            type="button"
            className="flex items-center gap-3 w-full pb-4 border-b border-slate-100 mb-1"
            onClick={() => setInsuranceOpen((o) => !o)}
          >
            <div className="p-2 bg-[#1B4F8A]/10 rounded-lg">
              <FileText size={18} className="text-[#1B4F8A]" />
            </div>
            <div className="flex-1 text-left">
              <h3 className="font-semibold text-slate-900">Insurance &amp; Referral</h3>
              <p className="text-xs text-slate-500 mt-0.5">Optional — can be added later</p>
            </div>
            {insuranceOpen ? (
              <ChevronUp size={16} className="text-slate-400" />
            ) : (
              <ChevronDown size={16} className="text-slate-400" />
            )}
          </button>

          {insuranceOpen && (
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Insurance Provider ID
                </label>
                <input
                  {...register("insuranceId")}
                  placeholder="INS-XXXXXX"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Referring Doctor (User ID)
                </label>
                <input
                  {...register("referringDoctorId")}
                  placeholder="User ID of the doctor"
                  className={inputCls}
                />
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pb-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 py-2.5 px-4 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 py-2.5 px-4 bg-[#1B4F8A] hover:bg-[#143C6B] text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {isSubmitting && <Loader2 size={14} className="animate-spin" />}
            Register Patient
          </button>
        </div>
      </form>
    </div>
  );
}

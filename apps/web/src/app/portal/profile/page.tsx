"use client";

import { useState } from "react";
import { User, Phone, Mail, MapPin, Shield, Bell, CheckCircle } from "lucide-react";

export default function PortalProfilePage() {
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    firstName: "Ravi",
    lastName: "Sharma",
    email: "ravi.sharma@example.com",
    phone: "+91 98765 43210",
    dob: "1985-06-15",
    gender: "MALE",
    bloodGroup: "O+",
    address: "42, MG Road, Bengaluru",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560001",
    emergencyName: "Priya Sharma",
    emergencyPhone: "+91 98765 12345",
    emergencyRelation: "Spouse",
  });
  const [notifications, setNotifications] = useState({
    reportReady: true,
    sampleCollected: true,
    orderConfirmed: true,
    promotions: false,
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="space-y-6">
      {saved && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm font-medium">
          <CheckCircle className="w-4 h-4" /> Profile updated successfully
        </div>
      )}

      {/* Personal Details */}
      <form onSubmit={handleSave}>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <User className="w-4 h-4 text-blue-600" />
            <h2 className="font-semibold text-slate-800">Personal Information</h2>
          </div>
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">First Name</label>
              <input
                name="firstName"
                value={form.firstName}
                onChange={handleChange}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Last Name</label>
              <input
                name="lastName"
                value={form.lastName}
                onChange={handleChange}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Date of Birth</label>
              <input
                type="date"
                name="dob"
                value={form.dob}
                onChange={handleChange}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Gender</label>
              <select
                name="gender"
                value={form.gender}
                onChange={handleChange}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Blood Group</label>
              <select
                name="bloodGroup"
                value={form.bloodGroup}
                onChange={handleChange}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm mt-4">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <Phone className="w-4 h-4 text-teal-600" />
            <h2 className="font-semibold text-slate-800">Contact Details</h2>
          </div>
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Mobile Number</label>
              <input
                name="phone"
                value={form.phone}
                onChange={handleChange}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Email Address</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm mt-4">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-purple-600" />
            <h2 className="font-semibold text-slate-800">Address</h2>
          </div>
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-500 mb-1">Street Address</label>
              <input
                name="address"
                value={form.address}
                onChange={handleChange}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">City</label>
              <input
                name="city"
                value={form.city}
                onChange={handleChange}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">State</label>
              <input
                name="state"
                value={form.state}
                onChange={handleChange}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">PIN Code</label>
              <input
                name="pincode"
                value={form.pincode}
                onChange={handleChange}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Emergency Contact */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm mt-4">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <Shield className="w-4 h-4 text-red-500" />
            <h2 className="font-semibold text-slate-800">Emergency Contact</h2>
          </div>
          <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Name</label>
              <input
                name="emergencyName"
                value={form.emergencyName}
                onChange={handleChange}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Phone</label>
              <input
                name="emergencyPhone"
                value={form.emergencyPhone}
                onChange={handleChange}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Relation</label>
              <input
                name="emergencyRelation"
                value={form.emergencyRelation}
                onChange={handleChange}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Save Changes
          </button>
        </div>
      </form>

      {/* Notification Preferences */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <Bell className="w-4 h-4 text-amber-500" />
          <h2 className="font-semibold text-slate-800">Notification Preferences</h2>
        </div>
        <div className="p-6 space-y-4">
          {[
            { key: "reportReady" as const, label: "Report Ready", desc: "Notify me when my test report is available" },
            { key: "sampleCollected" as const, label: "Sample Collected", desc: "Notify me when my sample has been collected" },
            { key: "orderConfirmed" as const, label: "Order Confirmed", desc: "Notify me when my test booking is confirmed" },
            { key: "promotions" as const, label: "Offers & Promotions", desc: "Receive offers on health packages and tests" },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between py-1">
              <div>
                <div className="text-sm font-medium text-slate-800">{item.label}</div>
                <div className="text-xs text-slate-500">{item.desc}</div>
              </div>
              <button
                type="button"
                onClick={() => setNotifications((prev) => ({ ...prev, [item.key]: !prev[item.key] }))}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${notifications[item.key] ? "bg-blue-600" : "bg-slate-200"}`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transform transition-transform ${notifications[item.key] ? "translate-x-4" : "translate-x-1"}`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Account Info */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Mail className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-600">Account Information</h3>
        </div>
        <p className="text-xs text-slate-500">
          Patient ID: <span className="font-mono font-semibold text-slate-700">MRN-20250001</span>
          &nbsp;·&nbsp; Member since: <span className="font-semibold text-slate-700">January 2025</span>
          &nbsp;·&nbsp; Account verified
        </p>
      </div>
    </div>
  );
}

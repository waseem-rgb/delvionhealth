"use client";

import { useState } from "react";
import { FlaskConical, Check, ChevronRight, ChevronLeft, X } from "lucide-react";
import { toast } from "sonner";

interface TestItem {
  id: string;
  code: string;
  name: string;
  category: string;
  price: number;
  turnaroundHours: number;
  sampleType: string;
}

type Step = 1 | 2 | 3;

const POPULAR_TESTS = [
  { code: "CBC", name: "Complete Blood Count", price: 350 },
  { code: "FBS", name: "Fasting Blood Sugar", price: 120 },
  { code: "HBA1C", name: "HbA1c", price: 550 },
  { code: "LIPID", name: "Lipid Profile", price: 600 },
  { code: "TFT", name: "Thyroid (TSH)", price: 750 },
  { code: "LFT", name: "Liver Function", price: 650 },
  { code: "KFT", name: "Kidney Function", price: 550 },
];

const TIME_SLOTS = [
  "06:00 AM", "06:30 AM", "07:00 AM", "07:30 AM",
  "08:00 AM", "08:30 AM", "09:00 AM", "09:30 AM",
  "10:00 AM", "10:30 AM", "11:00 AM",
];

const steps = [
  { num: 1, label: "Choose Tests" },
  { num: 2, label: "Schedule" },
  { num: 3, label: "Confirm & Pay" },
];

export default function BookTestPage() {
  const [step, setStep] = useState<Step>(1);
  const [cart, setCart] = useState<TestItem[]>([]);
  const [collectionType, setCollectionType] = useState<"HOME" | "CENTRE">("CENTRE");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [address, setAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"ONLINE" | "AT_CENTRE">("AT_CENTRE");
  const [agreed, setAgreed] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [loading, setLoading] = useState(false);

  const addToCart = (test: { code: string; name: string; price: number }) => {
    if (cart.some((t) => t.code === test.code)) return;
    setCart((prev) => [
      ...prev,
      {
        id: test.code,
        code: test.code,
        name: test.name,
        category: "General",
        price: test.price,
        turnaroundHours: 6,
        sampleType: "Serum",
      },
    ]);
  };

  const removeFromCart = (code: string) => {
    setCart((prev) => prev.filter((t) => t.code !== code));
  };

  const total = cart.reduce((s, t) => s + t.price, 0);

  const handleConfirm = async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1500));
    const num = `DH-ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(Math.random() * 9000 + 1000)}`;
    setOrderNumber(num);
    setConfirmed(true);
    setLoading(false);
    toast.success("Booking confirmed successfully!");
  };

  if (confirmed) {
    return (
      <div className="max-w-lg mx-auto text-center space-y-6">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <Check className="w-10 h-10 text-green-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Booking Confirmed!</h2>
          <p className="text-slate-500 mt-1">Your tests have been booked successfully.</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-6 font-mono text-2xl font-bold text-slate-800">
          {orderNumber}
        </div>
        <p className="text-sm text-slate-500">
          {collectionType === "HOME"
            ? `Your sample will be collected on ${selectedDate} at ${selectedTime}`
            : `Please visit our centre on ${selectedDate} at ${selectedTime}`}
        </p>
        <div className="flex gap-3 justify-center">
          <a
            href="/portal/reports"
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
          >
            View Reports
          </a>
          <a
            href={`/portal/track?order=${orderNumber}`}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            Track Order
          </a>
          <a
            href="/portal"
            className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50"
          >
            Back to Home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Book a Lab Test</h1>

      {/* Step indicator */}
      <div className="flex items-center gap-0">
        {steps.map((s, i) => (
          <div key={s.num} className="flex items-center flex-1">
            <div className={`flex items-center gap-2 ${step >= s.num ? "text-blue-700" : "text-slate-400"}`}>
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold border-2 ${
                  step > s.num
                    ? "bg-blue-600 border-blue-600 text-white"
                    : step === s.num
                    ? "border-blue-600 text-blue-600"
                    : "border-slate-300 text-slate-400"
                }`}
              >
                {step > s.num ? <Check className="w-4 h-4" /> : s.num}
              </div>
              <span className="text-sm font-medium hidden sm:block">{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-px mx-3 ${step > s.num ? "bg-blue-600" : "bg-slate-200"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Choose Tests */}
      {step === 1 && (
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-4">
            <div>
              <h3 className="font-semibold text-slate-800 mb-3">Popular Tests</h3>
              <div className="flex flex-wrap gap-2">
                {POPULAR_TESTS.map((t) => {
                  const inCart = cart.some((c) => c.code === t.code);
                  return (
                    <button
                      key={t.code}
                      onClick={() => (inCart ? removeFromCart(t.code) : addToCart(t))}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                        inCart
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-slate-700 border-slate-200 hover:border-blue-400"
                      }`}
                    >
                      {inCart && <Check className="w-3 h-3 inline mr-1" />}
                      {t.name} — ₹{t.price}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Cart */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 h-fit sticky top-24">
            <h3 className="font-semibold text-slate-800 mb-3">My Tests ({cart.length})</h3>
            {cart.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No tests added yet</p>
            ) : (
              <div className="space-y-2 mb-4">
                {cart.map((t) => (
                  <div key={t.code} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">{t.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-900 font-medium">₹{t.price}</span>
                      <button onClick={() => removeFromCart(t.code)} className="text-slate-400 hover:text-red-500">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="border-t border-slate-100 pt-2 flex justify-between font-semibold">
                  <span>Total</span>
                  <span>₹{total.toLocaleString("en-IN")}</span>
                </div>
              </div>
            )}
            <button
              onClick={() => {
                if (cart.length > 0) setStep(2);
                else toast.error("Please add at least one test");
              }}
              disabled={cart.length === 0}
              className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
            >
              Continue to Schedule <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Schedule */}
      {step === 2 && (
        <div className="max-w-xl space-y-5">
          <div>
            <h3 className="font-semibold text-slate-800 mb-3">Collection Type</h3>
            <div className="grid grid-cols-2 gap-3">
              {(["HOME", "CENTRE"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setCollectionType(type)}
                  className={`p-4 rounded-xl border-2 text-left transition-colors ${
                    collectionType === type ? "border-blue-600 bg-blue-50" : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="font-medium text-slate-900 text-sm">
                    {type === "HOME" ? "🏠 Home Collection" : "🏥 Visit Centre"}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {type === "HOME"
                      ? "We come to you — Free for orders above ₹500"
                      : "Visit Main Branch — Bengaluru, Indiranagar"}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {collectionType === "HOME" && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Collection Address</label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={3}
                placeholder="Enter your full address..."
                className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Preferred Date</label>
            <input
              type="date"
              value={selectedDate}
              min={new Date(Date.now() + 86400000).toISOString().split("T")[0]}
              max={new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Preferred Time</label>
            <div className="flex flex-wrap gap-2">
              {TIME_SLOTS.map((slot) => (
                <button
                  key={slot}
                  onClick={() => setSelectedTime(slot)}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                    selectedTime === slot
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white border-slate-200 hover:border-blue-400"
                  }`}
                >
                  {slot}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2.5 border border-slate-200 rounded-lg text-sm font-medium flex items-center gap-1 hover:bg-slate-50"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <button
              onClick={() => {
                if (!selectedDate || !selectedTime) {
                  toast.error("Please select date and time");
                  return;
                }
                if (collectionType === "HOME" && !address) {
                  toast.error("Please enter collection address");
                  return;
                }
                setStep(3);
              }}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 flex items-center justify-center gap-1"
            >
              Continue <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Confirm & Pay */}
      {step === 3 && (
        <div className="max-w-xl space-y-5">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-800 mb-4">Order Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Collection</span>
                <span>{collectionType === "HOME" ? "Home Collection" : "Visit Centre"}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Date & Time</span>
                <span>
                  {selectedDate} at {selectedTime}
                </span>
              </div>
              <div className="border-t border-slate-100 pt-2 mt-2 space-y-1">
                {cart.map((t) => (
                  <div key={t.code} className="flex justify-between">
                    <span className="text-slate-700">{t.name}</span>
                    <span className="font-medium">₹{t.price}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-slate-100 pt-2 flex justify-between text-base font-bold">
                <span>Total</span>
                <span>₹{total.toLocaleString("en-IN")}</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-slate-800 mb-3">Payment</h3>
            <div className="space-y-2">
              <button
                onClick={() => {
                  toast.info("Online payment integration coming soon. Please pay at centre for now.");
                }}
                className="w-full p-4 rounded-xl border-2 border-slate-200 text-left hover:border-slate-300 flex items-center gap-3"
              >
                <span>💳</span>
                <div>
                  <div className="font-medium text-sm text-slate-900">Pay Online</div>
                  <div className="text-xs text-slate-500">Razorpay — coming soon</div>
                </div>
              </button>
              <button
                onClick={() => setPaymentMethod("AT_CENTRE")}
                className={`w-full p-4 rounded-xl border-2 text-left flex items-center gap-3 transition-colors ${
                  paymentMethod === "AT_CENTRE"
                    ? "border-blue-600 bg-blue-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <span>🏥</span>
                <div>
                  <div className="font-medium text-sm text-slate-900">Pay at Centre</div>
                  <div className="text-xs text-slate-500">Pay when you arrive. No online payment required.</div>
                </div>
              </button>
            </div>
          </div>

          <label className="flex items-start gap-2 text-sm text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5"
            />
            I agree to the collection terms and privacy policy
          </label>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(2)}
              className="px-4 py-2.5 border border-slate-200 rounded-lg text-sm font-medium flex items-center gap-1 hover:bg-slate-50"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <button
              onClick={handleConfirm}
              disabled={!agreed || loading}
              className="flex-1 bg-green-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? "Confirming..." : "Confirm Booking"} {!loading && <Check className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

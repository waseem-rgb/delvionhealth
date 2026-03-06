interface BarcodeDisplayProps {
  value: string;
  label?: string;
  className?: string;
}

export function BarcodeDisplay({ value, label, className }: BarcodeDisplayProps) {
  return (
    <div className={`flex flex-col items-center gap-1 ${className ?? ""}`}>
      {/* Simple barcode visualization using CSS bars */}
      <div className="flex items-end gap-px h-12">
        {value
          .split("")
          .map((char, i) => {
            const code = char.charCodeAt(0);
            const height = 60 + (code % 40);
            const width = code % 2 === 0 ? 2 : 1;
            return (
              <div
                key={i}
                className="bg-black"
                style={{ height: `${height}%`, width: `${width}px` }}
              />
            );
          })}
      </div>
      <p className="font-mono text-xs text-slate-700 tracking-widest">{value}</p>
      {label && <p className="text-xs text-slate-500">{label}</p>}
    </div>
  );
}

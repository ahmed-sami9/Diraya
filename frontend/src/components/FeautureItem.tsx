import type { ReactNode } from 'react';

interface Feature {
  icon: string;
  alt: string;
  title: string;
  description: ReactNode;
}

const circleStyle: React.CSSProperties = {
  background: 'radial-gradient(circle at 38% 32%, #ffffff 0%, #f0edf9 55%, #ddd8f2 100%)',
  boxShadow: `
    0 8px 24px rgba(120, 100, 200, 0.22),
    0 2px 6px rgba(120, 100, 200, 0.15),
    inset 0 2px 4px rgba(255, 255, 255, 1),
    inset 0 -2px 6px rgba(160, 140, 210, 0.2)
  `,
};

const glossStyle: React.CSSProperties = {
  top: '10%',
  left: '18%',
  width: '30%',
  height: '18%',
  background: 'rgba(255,255,255,0.75)',
  filter: 'blur(3px)',
};

export default function FeatureItem({ icon, alt, title, description }: Feature) {
  return (
    <div
      className="
        flex w-full items-center gap-3
        rounded-xl border border-gray-200 bg-white
        px-4 py-2.5
        lg:items-start lg:border-0 lg:bg-transparent lg:py-0
      "
    >
      <div
        className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full"
        style={circleStyle}
      >
        <div
          className="absolute rounded-full"
          style={glossStyle}
        />
        <img
          src={icon}
          alt={alt}
          className="relative z-10 h-7 w-7 object-contain"
        />
      </div>

      <div className="min-w-0">
        <p className="whitespace-nowrap text-[15px] font-bold text-[#18134a]">{title}</p>
        <p className="mt-0.5 text-[13px] leading-snug text-slate-600">{description}</p>
      </div>
    </div>
  );
}

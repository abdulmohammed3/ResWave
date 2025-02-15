'use client';

export default function WaveDecoration() {
  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
        preserveAspectRatio="none"
        viewBox="0 0 1440 560"
      >
        <g className="wave-animation">
          <path
            className="wave wave1"
            d="M 0,107 C 57.6,171.4 172.8,407.8 288,429 C 403.2,450.2 460.8,217.6 576,213 C 691.2,208.4 748.8,427.6 864,406 C 979.2,384.4 1036.8,127.6 1152,105 C 1267.2,82.4 1382.4,255.4 1440,293L1440 560L0 560z"
            fill="rgba(65, 125, 188, 1)"
          />
          <path
            className="wave wave2"
            d="M 0,468 C 96,417 288,222.4 480,213 C 672,203.6 768,452 960,421 C 1152,390 1344,130.6 1440,58L1440 560L0 560z"
            fill="rgba(72, 141, 215, 1)"
          />
        </g>
      </svg>

      <style jsx>{`
        .wave-animation {
          animation: moveWaves 20s ease-in-out infinite alternate;
        }

        .wave1 {
          opacity: 0.7;
          animation: wave1 25s cubic-bezier(0.37, 0, 0.63, 1) infinite;
        }

        .wave2 {
          opacity: 0.5;
          animation: wave2 20s cubic-bezier(0.37, 0, 0.63, 1) infinite;
        }

        @keyframes moveWaves {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-15px);
          }
        }

        @keyframes wave1 {
          0% {
            transform: translateX(0);
          }
          50% {
            transform: translateX(-20px);
          }
          100% {
            transform: translateX(0);
          }
        }

        @keyframes wave2 {
          0% {
            transform: translateX(0);
          }
          50% {
            transform: translateX(20px);
          }
          100% {
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}
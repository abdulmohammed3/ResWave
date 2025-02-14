export default function WaveDecoration() {
  return (
    <div className="absolute bottom-0 left-0 w-full overflow-hidden transform translate-y-1/2 pointer-events-none">
      <svg
        className="w-full"
        height="50"
        viewBox="0 0 1000 100"
        preserveAspectRatio="none"
      >
        <path
          className="fill-current text-[#A8D8EA]"
          d="M0,0 C150,50 350,0 500,50 C650,100 850,50 1000,0 L1000,100 L0,100 Z"
        ></path>
      </svg>
    </div>
  );
}
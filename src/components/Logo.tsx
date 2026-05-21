type LogoProps = {
  className?: string;
};

function Logo({ className }: LogoProps) {
  return (
    <svg
      className={className}
      aria-hidden="true"
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="96" height="96" rx="24" fill="#DF5E42" />
      <path
        d="M24 55c3 14 14 23 28 23s25-9 28-23H24Z"
        fill="#FFF8EC"
        stroke="#FFF8EC"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path d="M29 54c2 5 11 9 23 9s21-4 23-9" stroke="#B84A31" strokeWidth="4" strokeLinecap="round" />
      <path
        d="M31 24l16 32"
        stroke="#FFE7B8"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        d="M53 17l-4 38"
        stroke="#FFE7B8"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        d="M70 25L55 56"
        stroke="#FFE7B8"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        d="M26 35h15"
        stroke="#FFF8EC"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M61 36h12"
        stroke="#FFF8EC"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default Logo;

import tboLogo from '../../assets/tbo-logo.svg';

interface LoadingSpinnerProps {
  message?: string;
}

export function LoadingSpinner({ message = 'Loading...' }: LoadingSpinnerProps) {
  return (
    <div className="tbo-card flex flex-col items-center justify-center gap-4 px-7 py-6 shadow-[rgba(0,0,0,0.05)_0px_1px_2px_0px]">
      <div
        className="relative grid h-16 w-16 place-items-center rounded-full bg-white shadow-[inset_0_0_0_1px_rgba(229,229,229,0.78),0_10px_30px_rgba(0,0,0,0.06)]"
        role="status"
        aria-label={message}
      >
        <span className="absolute inset-0 rounded-full border-2 border-[#e5e5e5] border-t-[#ef5223] border-r-[#614a39] animate-spin" />
        <span className="grid h-12 w-12 place-items-center overflow-hidden rounded-full bg-[#fcf1e9] p-2">
          <img src={tboLogo} alt="" className="h-full w-full object-contain" aria-hidden="true" />
        </span>
      </div>
      <p className="text-sm font-medium text-[#525252]">{message}</p>
    </div>
  );
}

function DirayaLogo() {
  return (
    <div
      className="
    w-auto h-auto grid grid-cols-[40px_auto] items-center gap-x-3 absolute top-5 left-5 right-5 z-10
    sm:left-[calc(50%-270px)] sm:right-8
    md:left-[max(2.5rem,calc(50%-352px))] md:right-10
    lg:left-8 lg:right-auto lg:top-9
    xl:left-10
  "
    >
      <img
        src="/diraya-logo-dark.png"
        alt="Diraya logo"
        className="w-auto h-auto"
      />

      <div className="flex flex-col gap-1">
        <span className="text-[28px] font-bold leading-none">Diraya</span>
        <span className="text-sm text-[#949494] leading-none">Educational Management System</span>
      </div>
    </div>
  );
}

export default DirayaLogo;

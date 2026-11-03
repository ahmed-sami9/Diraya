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
      {/* The blue logo on light backgrounds, the white one on dark. */}
      <img
        src="/diraya-logo-dark.png"
        alt="Diraya logo"
        className="w-10 h-auto dark:hidden"
      />
      <img
        src="/diraya-logo-light.png"
        alt="Diraya logo"
        className="hidden w-10 h-auto dark:block"
      />

      <div className="flex flex-col gap-1">
        <span className="text-[28px] font-bold leading-none">Diraya</span>
        {/* Phones hide it: the top-right buttons need the room, and the headline says what Diraya is */}
        <span className="hidden text-sm text-ink-muted leading-none sm:block">Educational Management System</span>
      </div>
    </div>
  );
}

export default DirayaLogo;

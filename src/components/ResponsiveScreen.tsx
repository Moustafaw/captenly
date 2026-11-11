import React from "react";

export function ResponsiveScreen({
  desktop,
  phone,
}: {
  desktop: React.ReactNode;
  phone: React.ReactNode;
}) {
  return (
    <>
      <div className="hidden lg:block w-full">{desktop}</div>
      <div className="block lg:hidden w-full">{phone}</div>
    </>
  );
}

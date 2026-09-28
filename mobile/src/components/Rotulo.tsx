import React from "react";
import { useTema } from "../theme/TemaProvider";
import { Texto } from "./Texto";

export function Rotulo({ children }: { children: React.ReactNode }) {
  const { espaco } = useTema();
  return (
    <Texto variante="pequenoForte" style={{ marginTop: espaco.lg, marginBottom: espaco.sm }}>
      {children}
    </Texto>
  );
}

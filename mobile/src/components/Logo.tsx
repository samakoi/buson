import React from "react";
import Svg, { Circle, Defs, G, LinearGradient, Rect, Stop } from "react-native-svg";

/**
 * Logo do Bus On — mesma geometria de assets/fonte/icone.svg (de onde saem o
 * ícone e o splash). As cores são as da marca, iguais nos dois temas.
 */
export function Logo({ tamanho = 72 }: { tamanho?: number }) {
  return (
    <Svg width={tamanho} height={tamanho} viewBox="0 0 1024 1024" accessibilityLabel="Bus On">
      <Defs>
        <LinearGradient id="fundoLogo" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#2A6BC0" />
          <Stop offset="1" stopColor="#0D2F52" />
        </LinearGradient>
      </Defs>
      <Rect width={1024} height={1024} rx={232} fill="url(#fundoLogo)" />
      <G>
        <Rect x={236} y={352} width={36} height={112} rx={18} fill="#FFFFFF" />
        <Rect x={752} y={352} width={36} height={112} rx={18} fill="#FFFFFF" />
        <Rect x={262} y={372} width={40} height={18} rx={9} fill="#FFFFFF" />
        <Rect x={722} y={372} width={40} height={18} rx={9} fill="#FFFFFF" />
        <Rect x={292} y={224} width={440} height={528} rx={76} fill="#FFFFFF" />
        <Rect x={360} y={262} width={304} height={40} rx={20} fill="#7EB3F0" />
        <Rect x={336} y={332} width={352} height={212} rx={32} fill="#0D2F52" />
        <Rect x={360} y={352} width={120} height={16} rx={8} fill="#2A6BC0" opacity={0.9} />
        <Circle cx={390} cy={640} r={36} fill="#F2BB55" />
        <Circle cx={634} cy={640} r={36} fill="#F2BB55" />
        <Rect x={466} y={618} width={92} height={18} rx={9} fill="#C9D8EC" />
        <Rect x={466} y={648} width={92} height={18} rx={9} fill="#C9D8EC" />
        <Rect x={318} y={706} width={388} height={30} rx={15} fill="#C9D8EC" />
        <Rect x={338} y={752} width={88} height={64} rx={24} fill="#FFFFFF" />
        <Rect x={598} y={752} width={88} height={64} rx={24} fill="#FFFFFF" />
      </G>
    </Svg>
  );
}

import { createHash } from "node:crypto";
export const sourcePins = {
  "catalog.html": "da2204b8c4234030e7a6ae9dbcdc9af8a7cbcac068ae89f369c9dda72f4eeaaf",
  "Spassky.pgn": "9c495f1f8cb252d7a543d2d3ec07d9a17e0ac05c0829c4780fb1fef992edcf1b",
  "Spassky.zip": "a533e447443f37b7e5c32bce77e5f5f22e7c2c8b392feb758377e7c01c50f467",
  "Tal.pgn": "da7d473f53ac933c3a14ca4aff872bc50fe64385234f3635094cc500c0b0ad59",
  "Tal.zip": "4fef900575a39450bfe953fd60ede363c2d72994fdf388494374d68708588afd",
  "Fischer.pgn": "1d8afba5a95ed42588e3714af173f8dcf2cd56e06c9814373aa773064e53edf3",
  "Fischer.zip": "c07174dd3a66116ca74ac3b466e771a53de95068bcafa0a453f6df65d36e0b2b",
} as const;
export function assertSourcePin(name: keyof typeof sourcePins, bytes: Buffer) {
  if (createHash("sha256").update(bytes).digest("hex") !== sourcePins[name])
    throw Error(`Changed source bytes: ${name}`);
}

// Ét sted at afgøre, om et værtsnavn er vores eget.
//
// Listen stod i middleware.ts alene, men layoutet skal bruge den samme
// vurdering: på en klubs eget domæne skal vores navigation ikke vises. To
// kopier af den slags liste driver fra hinanden, og resultatet er en
// klubside med "RacketBuddy · Book bane" i toppen.

const OWN_HOSTS = [
  "localhost",
  "127.0.0.1",
  "racketbuddy.app",
  "www.racketbuddy.app",
  "tennis-makker.onrender.com",
];

export function isOwnHost(host: string): boolean {
  const clean = host.split(":")[0].toLowerCase();
  return (
    OWN_HOSTS.includes(clean) ||
    clean.endsWith(".onrender.com") ||
    clean.endsWith(".vercel.app")
  );
}

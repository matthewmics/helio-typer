import type { Metadata } from "next";
import { Chakra_Petch, JetBrains_Mono } from "next/font/google";
import { Starfield } from "@/components/layout/starfield";
import { MatchmakingProvider } from "@/components/matchmaking/matchmaking-provider";
import "./globals.css";

const chakraPetch = Chakra_Petch({
  variable: "--font-chakra-petch",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HelioTyper",
  description:
    "A typing race to the heliopause. Every correct keystroke builds thrust.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${chakraPetch.variable} ${jetbrainsMono.variable} antialiased`}
    >
      <body className="min-h-dvh">
        <Starfield />
        {/*
          Mounted at the root rather than in the shell, so the socket is not torn
          down on the way into /play. A guest identity is tied to its socket, so
          reconnecting on navigation would rename the pilot mid-handoff and drop
          them out of the match they just accepted.
        */}
        <MatchmakingProvider>{children}</MatchmakingProvider>
      </body>
    </html>
  );
}

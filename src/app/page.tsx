import Image from "next/image";
import { HomePage } from "./components/HomePage/HomePage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
};

export default function Home() {
  return (
    <HomePage />
  );
}

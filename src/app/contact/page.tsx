import Contact from "@/app/components/Contact/Contact";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact',
  alternates: {
    canonical: '/contact',
  },
};

export default function Home() {
  return (
    <Contact />
  );
}

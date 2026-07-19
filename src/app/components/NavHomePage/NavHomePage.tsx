"use client"
import React from 'react'
import Link from 'next/link';

const navigation = [
    { name: "Projects", href: "/repositories" },
    { name: "CV", href: "/cv" },
    { name: "Contact", href: "/contact" },
  ];

export const NavHomePage = () => {
  return (
    <nav className="my-16 animate-fade-in">
        <ul className="flex items-center justify-center gap-4">
          {navigation.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="text-sm duration-500 text-white hover:text-green-300 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-green-400 focus-visible:ring-offset-black"
              >
                {item.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
  )
}

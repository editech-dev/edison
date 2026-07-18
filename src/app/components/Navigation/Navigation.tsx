// src/app/components/Navigation/Navigation.tsx (o donde esté)

"use client";

import { FaArrowLeft } from "react-icons/fa";
import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from 'next/navigation';

export const Navigation: React.FC = () => {
    const ref = useRef<HTMLElement>(null);
    const [isIntersecting, setIntersecting] = useState(true);
    const currentPath = usePathname();
    const router = useRouter();

    // Track page views in this tab session for smart go-back fallbacks
    useEffect(() => {
        if (typeof window !== "undefined") {
            const count = parseInt(sessionStorage.getItem("nav_count") || "0", 10);
            sessionStorage.setItem("nav_count", (count + 1).toString());
        }
    }, [currentPath]);

    useEffect(() => {
        if (!ref.current) return;
        const observer = new IntersectionObserver(([entry]) =>
            setIntersecting(entry.isIntersecting),
        );

        observer.observe(ref.current);
        return () => observer.disconnect();
    }, []);

    const isProjectsActive = currentPath === '/repositories' || currentPath.startsWith('/repositories/');
    const isContactActive = currentPath === '/contact';

    const handleGoBack = () => {
        const count = typeof window !== "undefined" ? parseInt(sessionStorage.getItem("nav_count") || "0", 10) : 0;
        if (count > 1) {
            router.back();
        } else {
            // Smart fallback: if details page, go to index. Otherwise go home.
            if (currentPath.startsWith('/repositories/')) {
                router.push('/repositories');
            } else {
                router.push('/');
            }
        }
    };

    // Definimos el estilo base y hover que queremos para todos los elementos interactivos
    const commonLinkStyle = "duration-200 text-green-400 hover:text-green-300 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-green-400 focus-visible:ring-offset-zinc-900";
    // Para el botón, añadimos también los estilos de foco y cursor
    const commonButtonStyle = "duration-200 text-green-400 hover:text-green-300 cursor-pointer rounded-full p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-green-400 focus-visible:ring-offset-zinc-900";

    return (
        <header ref={ref}>
            <div
                className={`fixed inset-x-0 top-0 z-50 backdrop-blur duration-200 border-b ${
                    isIntersecting
                        ? "bg-zinc-900/0 border-transparent"
                        : "bg-zinc-900/80 border-zinc-800/60 backdrop-blur-md"
                }`}
            >
                <div className="container flex flex-row-reverse items-center justify-between p-6 mx-auto">
                    {/* Links de Navegación */}
                    <nav className="flex justify-between gap-8" aria-label="Main Navigation">
                        {/* Enlace Projects / Home */}
                        <Link
                            href={isProjectsActive ? '/' : '/repositories'}
                            // ---- INICIO CAMBIO Estilo ----
                            // Se aplica el estilo común directamente. Ya no cambia si está activo.
                            className={commonLinkStyle}
                            // ---- FIN CAMBIO Estilo ----
                        >
                            {isProjectsActive ? 'Home' : 'Projects'}
                        </Link>

                        {/* Enlace Contact / Home */}
                        <Link
                            href={isContactActive ? '/' : '/contact'}
                            // ---- INICIO CAMBIO Estilo ----
                            // Se aplica el estilo común directamente. Ya no cambia si está activo.
                            className={commonLinkStyle}
                            // ---- FIN CAMBIO Estilo ----
                        >
                            {isContactActive ? 'Home' : 'Contact'}
                        </Link>
                    </nav>

                    {/* Botón "Atrás" */}
                    <button
                        onClick={handleGoBack}
                        type="button"
                        // ---- INICIO CAMBIO Estilo ----
                        // Se aplica el estilo común de botón (que incluye el de enlace + extras)
                        className={commonButtonStyle}
                        // ---- FIN CAMBIO Estilo ----
                        aria-label="Go back to the previous page"
                    >
                        <FaArrowLeft className="w-6 h-6" aria-hidden="true" />
                    </button>
                </div>
            </div>
        </header>
    );
};
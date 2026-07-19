import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock framer-motion to avoid animation issues in JSDOM ──
vi.mock('framer-motion', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const React = require('react');
  return {
    motion: {
      div: React.forwardRef((props: any, ref: any) => {
        const { children, initial, animate, exit, transition, ...rest } = props;
        return React.createElement('div', { ref, ...rest }, children);
      }),
    },
    AnimatePresence: ({ children }: any) => children,
  };
});

// ── Mock CSS module ──
vi.mock('./CvPage.module.css', () => ({ default: {} }));

import CvClientPage from './CvClientPage';

// ── Simplified mock profile ──
const mockProfile = {
  personal: {
    name: 'Edison Esteban Isaza López',
    title_es: 'AI Prompt Engineering | Full-Stack',
    title_en: 'AI Prompt Engineering | Full-Stack',
    contact: {
      email: 'edisonisaza@gmail.com',
      phone: '+57 322 375 2131',
      linkedin: 'https://www.linkedin.com/in/edison-isaza',
      github: 'https://github.com/editech-dev',
      website: 'https://editech.dev',
      location_es: 'Medellín, Colombia',
      location_en: 'Medellin, Colombia',
    },
    summary_es: 'Resumen profesional en español.',
    summary_en: 'Professional summary in English.',
  },
  experience: [
    {
      company: 'Grupo Unión',
      role_es: 'Desarrollador Full-Stack',
      role_en: 'Full-Stack Developer',
      dates_es: 'Noviembre 2021 – Presente',
      dates_en: 'November 2021 – Present',
      location_es: 'Medellín, Colombia',
      location_en: 'Medellin, Colombia',
      details_es: ['Detalle 1', 'Detalle 2'],
      details_en: ['Detail 1 en', 'Detail 2 en'],
    },
    {
      company: 'Jonyco Latam',
      role_es: 'Ingeniero de Datos',
      role_en: 'Data Engineer',
      dates_es: 'Febrero 2025 – Abril 2025',
      dates_en: 'February 2025 – April 2025',
      location_es: 'Bogotá, Colombia',
      location_en: 'Bogota, Colombia',
      details_es: ['Detalle A'],
      details_en: ['Detail A en'],
    },
  ],
  education: [
    {
      institution: 'Holberton School',
      degree_es: 'Desarrollador de Software Full-Stack',
      degree_en: 'Full-Stack Software Engineering Program',
      year: '2020 – 2021',
      description_es: 'Formación intensiva basada en proyectos.',
      description_en: 'Project-based software engineering program.',
    },
    {
      institution: 'Colegio Militar',
      degree_es: 'Bachiller Académico',
      degree_en: 'High School Diploma',
      year: '2010',
    },
  ],
  skills: {
    categories_es: [
      {
        name: 'Ciencia de Datos e IA',
        items: ['Machine Learning', 'IA Conversacional'],
      },
      {
        name: 'Desarrollo de Software',
        items: ['Python', 'React', 'TypeScript'],
      },
    ],
    categories_en: [
      {
        name: 'Data Science & AI',
        items: ['Machine Learning', 'Conversational AI'],
      },
      {
        name: 'Software Development',
        items: ['Python', 'React', 'TypeScript'],
      },
    ],
  },
  certifications_es: ['Certificación SecurOS Nivel 3', 'Curso de Power BI'],
  certifications_en: ['SecurOS Level 3 Certified', 'Power BI Course'],
  presentations_es: [
    {
      title: 'Tendencias de Inversiones con Criptomonedas',
      institution: 'Tecnológico de Antioquia',
      date: 'Abril 2025',
      location: 'Medellín, Colombia',
    },
  ],
  presentations_en: [
    {
      title: 'New Investment Trends with Cryptocurrencies',
      institution: 'Tecnológico de Antioquia',
      date: 'April 2025',
      location: 'Medellin, Colombia',
    },
  ],
  soft_skills_es: ['Autoaprendizaje', 'Trabajo en equipo'],
  soft_skills_en: ['Self-Learning', 'Teamwork'],
  languages_es: [
    { language: 'Español', level: 'Nativo' },
    { language: 'Inglés', level: 'B1' },
  ],
  languages_en: [
    { language: 'Spanish', level: 'Native' },
    { language: 'English', level: 'B1' },
  ],
};

describe('CvClientPage', () => {
  // ── Reusable spy mocks for the download flow ──
  let mockCreateObjectURL: ReturnType<typeof vi.fn>;
  let mockRevokeObjectURL: ReturnType<typeof vi.fn>;
  let appendChildSpy: ReturnType<typeof vi.spyOn>;
  let removeChildSpy: ReturnType<typeof vi.spyOn>;
  let clickSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // ── Mock fetch globally ──
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(new Blob(['fake-pdf'], { type: 'application/pdf' })),
      }),
    );

    // ── Mock window.print ──
    vi.stubGlobal('print', vi.fn());

    // ── Mock window.alert ──
    vi.stubGlobal('alert', vi.fn());

    // ── Mock URL.createObjectURL / revokeObjectURL ──
    mockCreateObjectURL = vi.fn(() => 'blob:fake-url');
    mockRevokeObjectURL = vi.fn();
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: mockCreateObjectURL,
      revokeObjectURL: mockRevokeObjectURL,
    });

    // ── Spy on document.createElement for the download link ──
    clickSpy = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = originalCreateElement(tag);
      if (tag === 'a') {
        // Override click to track it
        el.click = clickSpy;
      }
      return el;
    });

    appendChildSpy = vi.spyOn(document.body, 'appendChild');
    removeChildSpy = vi.spyOn(document.body, 'removeChild');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // ──────────────────────────────────────────────
  // 1. Error state (null profile)
  // ──────────────────────────────────────────────
  it('displays error message when profile is null', () => {
    render(<CvClientPage profile={null} />);
    expect(
      screen.getByText(/error loading cv profile data/i),
    ).toBeInTheDocument();
  });

  // ──────────────────────────────────────────────
  // 2. Both buttons exist
  // ──────────────────────────────────────────────
  it('renders both "Exportar PDF" and "Descargar CV Profesional" buttons', () => {
    render(<CvClientPage profile={mockProfile} />);

    const exportBtn = screen.getByRole('button', { name: /exportar a pdf/i });
    const downloadBtn = screen.getByRole('button', {
      name: /descargar cv profesional/i,
    });

    expect(exportBtn).toBeInTheDocument();
    expect(exportBtn).toHaveTextContent('Exportar PDF');
    expect(downloadBtn).toBeInTheDocument();
    expect(downloadBtn).toHaveTextContent('Descargar CV Profesional');
  });

  it('renders the language toggle button', () => {
    render(<CvClientPage profile={mockProfile} />);

    const toggleBtn = screen.getByRole('button', {
      name: /switch to english/i,
    });
    expect(toggleBtn).toBeInTheDocument();
    expect(toggleBtn).toHaveTextContent('English');
  });

  // ──────────────────────────────────────────────
  // 3. Language toggle
  // ──────────────────────────────────────────────
  it('switches language from ES to EN when toggle is clicked', async () => {
    render(<CvClientPage profile={mockProfile} />);

    // Initially Spanish
    expect(screen.getByText('Perfil Profesional')).toBeInTheDocument();
    expect(screen.getByText('Experiencia Laboral')).toBeInTheDocument();
    expect(screen.getByText('Habilidades')).toBeInTheDocument();

    // Click toggle to switch to English
    const toggleBtn = screen.getByRole('button', {
      name: /switch to english/i,
    });
    await userEvent.click(toggleBtn);

    // Now English content should appear
    await waitFor(() => {
      expect(screen.getByText('Professional Summary')).toBeInTheDocument();
    });
    expect(screen.getByText('Work Experience')).toBeInTheDocument();
    expect(screen.getByText('Skills')).toBeInTheDocument();

    // Button labels should update
    const downloadBtn = screen.getByRole('button', {
      name: /download professional cv/i,
    });
    expect(downloadBtn).toHaveTextContent('Download Professional CV');
  });

  it('can switch back from EN to ES', async () => {
    render(<CvClientPage profile={mockProfile} />);

    // Switch to EN first
    const toggleBtn = screen.getByRole('button', {
      name: /switch to english/i,
    });
    await userEvent.click(toggleBtn);

    await waitFor(() => {
      expect(screen.getByText('Professional Summary')).toBeInTheDocument();
    });

    // Switch back to ES
    const toggleEsBtn = screen.getByRole('button', {
      name: /cambiar a español/i,
    });
    expect(toggleEsBtn).toHaveTextContent('Español');
    await userEvent.click(toggleEsBtn);

    await waitFor(() => {
      expect(screen.getByText('Perfil Profesional')).toBeInTheDocument();
    });
  });

  // ──────────────────────────────────────────────
  // 4. All sections render
  // ──────────────────────────────────────────────
  it('renders the header with name and title', () => {
    render(<CvClientPage profile={mockProfile} />);

    expect(screen.getByText('Edison Esteban Isaza López')).toBeInTheDocument();
    expect(screen.getByText('AI Prompt Engineering | Full-Stack')).toBeInTheDocument();
  });

  it('renders contact information in the header', () => {
    render(<CvClientPage profile={mockProfile} />);

    expect(screen.getByText('edisonisaza@gmail.com')).toBeInTheDocument();
    expect(screen.getByText('+57 322 375 2131')).toBeInTheDocument();
    // "Medellín, Colombia" appears in both contact header and experience items
    const locationMatches = screen.getAllByText('Medellín, Colombia');
    expect(locationMatches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders the professional summary section', () => {
    render(<CvClientPage profile={mockProfile} />);

    expect(screen.getByText('Perfil Profesional')).toBeInTheDocument();
    expect(
      screen.getByText('Resumen profesional en español.'),
    ).toBeInTheDocument();
  });

  it('renders the work experience section with job entries', () => {
    render(<CvClientPage profile={mockProfile} />);

    expect(screen.getByText('Experiencia Laboral')).toBeInTheDocument();
    expect(screen.getByText('Grupo Unión')).toBeInTheDocument();
    expect(screen.getByText('Desarrollador Full-Stack')).toBeInTheDocument();
    expect(screen.getByText('Jonyco Latam')).toBeInTheDocument();
    expect(screen.getByText('Ingeniero de Datos')).toBeInTheDocument();
    expect(screen.getByText('Detalle 1')).toBeInTheDocument();
    expect(screen.getByText('Detalle 2')).toBeInTheDocument();
  });

  it('renders the skills section with categories', () => {
    render(<CvClientPage profile={mockProfile} />);

    expect(screen.getByText('Habilidades')).toBeInTheDocument();
    expect(screen.getByText('Habilidades Técnicas')).toBeInTheDocument();
    expect(screen.getByText('Ciencia de Datos e IA')).toBeInTheDocument();
    expect(screen.getByText('Machine Learning')).toBeInTheDocument();
    expect(screen.getByText('Habilidades Blandas')).toBeInTheDocument();
    expect(screen.getByText('Autoaprendizaje')).toBeInTheDocument();
  });

  it('renders the education section', () => {
    render(<CvClientPage profile={mockProfile} />);

    expect(screen.getByText('Educación')).toBeInTheDocument();
    expect(screen.getByText('Holberton School')).toBeInTheDocument();
    expect(
      screen.getByText('Desarrollador de Software Full-Stack'),
    ).toBeInTheDocument();
  });

  it('renders the certifications section', () => {
    render(<CvClientPage profile={mockProfile} />);

    expect(screen.getByText('Certificaciones')).toBeInTheDocument();
    expect(
      screen.getByText('Certificación SecurOS Nivel 3'),
    ).toBeInTheDocument();
    expect(screen.getByText('Curso de Power BI')).toBeInTheDocument();
  });

  it('renders the languages section', () => {
    render(<CvClientPage profile={mockProfile} />);

    expect(screen.getByText('Idiomas')).toBeInTheDocument();
    expect(screen.getByText('Español')).toBeInTheDocument();
    expect(screen.getByText('Nativo')).toBeInTheDocument();
  });

  it('renders the presentations section', () => {
    render(<CvClientPage profile={mockProfile} />);

    expect(screen.getByText('Ponencias y Charlas')).toBeInTheDocument();
    expect(
      screen.getByText('Tendencias de Inversiones con Criptomonedas'),
    ).toBeInTheDocument();
  });

  it('renders the footer', () => {
    render(<CvClientPage profile={mockProfile} />);

    expect(screen.getByText(/© 2026/)).toBeInTheDocument();
    // Name appears in both header and footer
    const nameMatches = screen.getAllByText(/Edison Esteban Isaza López/);
    expect(nameMatches.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/Optimizado para lectura digital/)).toBeInTheDocument();
  });

  // ──────────────────────────────────────────────
  // 5. Exportar PDF button calls window.print
  // ──────────────────────────────────────────────
  it('calls window.print() when "Exportar PDF" is clicked', async () => {
    render(<CvClientPage profile={mockProfile} />);

    const exportBtn = screen.getByRole('button', {
      name: /exportar a pdf/i,
    });
    await userEvent.click(exportBtn);

    expect(window.print).toHaveBeenCalledTimes(1);
  });

  // ──────────────────────────────────────────────
  // 6. Download Professional CV flow
  // ──────────────────────────────────────────────
  it('fetches /api/cv-pdf?lang=es when download CV is clicked (Spanish)', async () => {
    render(<CvClientPage profile={mockProfile} />);

    const downloadBtn = screen.getByRole('button', {
      name: /descargar cv profesional/i,
    });
    await userEvent.click(downloadBtn);

    await waitFor(() => {
      expect(window.fetch).toHaveBeenCalledWith('/api/cv-pdf?lang=es');
    });
  });

  it('fetches /api/cv-pdf?lang=en when download CV is clicked (English)', async () => {
    render(<CvClientPage profile={mockProfile} />);

    // Switch to English first
    const toggleBtn = screen.getByRole('button', {
      name: /switch to english/i,
    });
    await userEvent.click(toggleBtn);

    await waitFor(() => {
      expect(screen.getByText('Professional Summary')).toBeInTheDocument();
    });

    const downloadBtn = screen.getByRole('button', {
      name: /download professional cv/i,
    });
    await userEvent.click(downloadBtn);

    await waitFor(() => {
      expect(window.fetch).toHaveBeenCalledWith('/api/cv-pdf?lang=en');
    });
  });

  it('creates a download link and triggers click on successful PDF fetch', async () => {
    render(<CvClientPage profile={mockProfile} />);

    const downloadBtn = screen.getByRole('button', {
      name: /descargar cv profesional/i,
    });
    await userEvent.click(downloadBtn);

    await waitFor(() => {
      // Verify createObjectURL was called with the blob
      expect(mockCreateObjectURL).toHaveBeenCalledTimes(1);
      // Verify a link was created
      expect(document.createElement).toHaveBeenCalledWith('a');
      // Verify link was appended to body
      expect(appendChildSpy).toHaveBeenCalled();
      // Verify link.click was called
      expect(clickSpy).toHaveBeenCalledTimes(1);
      // Verify link was removed
      expect(removeChildSpy).toHaveBeenCalled();
      // Verify URL was revoked
      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:fake-url');
    });
  });

  it('sets Spanish filename when downloading in ES', async () => {
    render(<CvClientPage profile={mockProfile} />);

    const downloadBtn = screen.getByRole('button', {
      name: /descargar cv profesional/i,
    });
    await userEvent.click(downloadBtn);

    await waitFor(() => {
      const anchor = vi.mocked(document.createElement).mock.results.find(
        (r) => r.value instanceof HTMLAnchorElement,
      )?.value as HTMLAnchorElement | undefined;
      // We check that the last created <a> element has download attribute
      expect(vi.mocked(document.createElement)).toHaveBeenCalledWith('a');
    });
  });

  it('shows alert when PDF fetch fails (Spanish)', async () => {
    // Override fetch to fail
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
      }),
    );

    render(<CvClientPage profile={mockProfile} />);

    const downloadBtn = screen.getByRole('button', {
      name: /descargar cv profesional/i,
    });
    await userEvent.click(downloadBtn);

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(
        'Error al generar el PDF. Intenta de nuevo.',
      );
    });
  });

  it('shows alert (English) when PDF fetch fails in English mode', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
      }),
    );

    render(<CvClientPage profile={mockProfile} />);

    // Switch to EN
    const toggleBtn = screen.getByRole('button', {
      name: /switch to english/i,
    });
    await userEvent.click(toggleBtn);

    await waitFor(() => {
      expect(screen.getByText('Professional Summary')).toBeInTheDocument();
    });

    const downloadBtn = screen.getByRole('button', {
      name: /download professional cv/i,
    });
    await userEvent.click(downloadBtn);

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(
        'Error generating PDF. Please try again.',
      );
    });
  });

  it('shows error alert on network failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Network error')),
    );

    render(<CvClientPage profile={mockProfile} />);

    const downloadBtn = screen.getByRole('button', {
      name: /descargar cv profesional/i,
    });
    await userEvent.click(downloadBtn);

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(
        'Error al generar el PDF. Intenta de nuevo.',
      );
    });
  });
});

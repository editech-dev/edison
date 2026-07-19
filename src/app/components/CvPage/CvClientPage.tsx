"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaEnvelope, 
  FaPhone, 
  FaMapMarkerAlt, 
  FaLinkedin, 
  FaGithub, 
  FaGlobe,
  FaFilePdf,
  FaLanguage
} from 'react-icons/fa';
import styles from './CvPage.module.css';

interface CvClientPageProps {
  profile: any;
}

export default function CvClientPage({ profile }: CvClientPageProps) {
  const [lang, setLang] = useState<'es' | 'en'>('es');

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen text-red-500">
        <p>Error loading CV profile data. Please verify your Redis connection or fallback data.</p>
      </div>
    );
  }

  const isEs = lang === 'es';
  const { personal, experience, education, skills, certifications_es, certifications_en, presentations_es, presentations_en, soft_skills_es, soft_skills_en, languages_es, languages_en } = profile;

  const currentTitle = isEs ? personal.title_es : personal.title_en;
  const currentSummary = isEs ? personal.summary_es : personal.summary_en;
  const currentSkillsCategories = isEs ? skills.categories_es : skills.categories_en;
  const currentSoftSkills = isEs ? soft_skills_es : soft_skills_en;
  const currentLanguages = isEs ? languages_es : languages_en;
  const currentCertifications = isEs ? certifications_es : certifications_en;
  const currentPresentations = isEs ? presentations_es : presentations_en;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className={`relative pb-24 bg-gradient-to-tl from-black via-zinc-600/20 to-black min-h-screen text-zinc-200 font-sans ${styles.cvPageContainer}`}>
      
      {/* Dynamic Controls Bar */}
      <div className="no-print pt-24 pb-6 px-6 max-w-4xl mx-auto flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-green-400 sm:text-4xl">
            {isEs ? "Mi Hoja de Vida" : "My Resume / CV"}
          </h1>
          <p className="mt-2 text-green-300 text-sm">
            {isEs ? "Versión digital interactiva, optimizada para exportación PDF y lectura ATS." : "Interactive digital version, optimized for PDF export and ATS compatibility."}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Language Toggle Button */}
          <button
            onClick={() => setLang(prev => prev === 'es' ? 'en' : 'es')}
            className="bg-zinc-900 border border-green-500/30 hover:border-green-400 hover:text-green-300 text-green-400 rounded-full px-4 py-2 flex items-center gap-2 cursor-pointer transition-all duration-300 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-green-400/80"
            aria-label={isEs ? "Switch to English" : "Cambiar a Español"}
          >
            <FaLanguage className="w-4 h-4" />
            <span>{isEs ? "English" : "Español"}</span>
          </button>
          
          {/* Export PDF Button */}
          <button
            onClick={handlePrint}
            className="bg-green-500/10 border border-green-500/40 hover:bg-green-500 hover:text-black text-green-400 rounded-full px-4 py-2 flex items-center gap-2 cursor-pointer transition-all duration-300 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-green-400"
            aria-label={isEs ? "Exportar a PDF" : "Export to PDF"}
          >
            <FaFilePdf className="w-4 h-4" />
            <span>{isEs ? "Exportar PDF" : "Export PDF"}</span>
          </button>
        </div>
      </div>

      <div className="no-print w-full max-w-4xl mx-auto px-6 mb-8">
        <div className="w-full h-px bg-zinc-800" />
      </div>

      {/* Main CV Content Wrapper */}
      <main className="cv-wrapper max-w-4xl mx-auto px-6" id="cv-content">
        <div className="bg-zinc-950/60 border border-zinc-900 md:border-zinc-800/80 rounded-2xl p-6 md:p-12 shadow-2xl backdrop-blur-md space-y-12">
          
          {/* HEADER SECTION */}
          <header className="cv-header border-b border-zinc-800 pb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="header-main space-y-2 max-w-2xl">
              <h1 className="name-title text-3xl md:text-4xl font-extrabold text-white tracking-tight">
                {personal.name}
              </h1>
              <p className="professional-title text-base md:text-lg font-medium text-green-400">
                {currentTitle}
              </p>
            </div>
            
            <div className="header-contact flex flex-wrap md:flex-col gap-x-4 gap-y-2 text-sm text-zinc-400">
              <div className="contact-item flex items-center gap-2">
                <FaEnvelope className="w-3.5 h-3.5 text-green-500/70 no-print" />
                <a href={`mailto:${personal.contact.email}`} className="hover:text-green-300 transition-colors">
                  {personal.contact.email}
                </a>
              </div>
              <div className="contact-item flex items-center gap-2">
                <FaPhone className="w-3.5 h-3.5 text-green-500/70 no-print" />
                <span>{personal.contact.phone}</span>
              </div>
              <div className="contact-item flex items-center gap-2">
                <FaMapMarkerAlt className="w-3.5 h-3.5 text-green-500/70 no-print" />
                <span>{isEs ? personal.contact.location_es : personal.contact.location_en}</span>
              </div>
              <div className="contact-item flex items-center gap-2">
                <FaLinkedin className="w-3.5 h-3.5 text-green-500/70 no-print" />
                <a href={personal.contact.linkedin} target="_blank" rel="noopener noreferrer" className="hover:text-green-300 transition-colors">
                  linkedin.com/in/edison-isaza
                </a>
              </div>
              <div className="contact-item flex items-center gap-2">
                <FaGithub className="w-3.5 h-3.5 text-green-500/70 no-print" />
                <a href={personal.contact.github} target="_blank" rel="noopener noreferrer" className="hover:text-green-300 transition-colors">
                  github.com/editech-dev
                </a>
              </div>
              <div className="contact-item flex items-center gap-2">
                <FaGlobe className="w-3.5 h-3.5 text-green-500/70 no-print" />
                <a href={personal.contact.website} target="_blank" rel="noopener noreferrer" className="hover:text-green-300 transition-colors">
                  editech.dev
                </a>
              </div>
            </div>
          </header>

          {/* Animate translation shifts smoothly */}
          <AnimatePresence mode="wait">
            <motion.div
              key={lang}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-12"
            >
              {/* PROFESSIONAL SUMMARY */}
              <section className="cv-section" id="section-summary">
                <h2 className="section-title text-xl font-bold text-white tracking-wide uppercase">
                  {isEs ? "Perfil Profesional" : "Professional Summary"}
                </h2>
                <div className="section-divider h-0.5 bg-gradient-to-r from-green-500/50 via-zinc-800 to-transparent mt-2 mb-4" />
                <p className="summary-text text-sm md:text-base text-zinc-300 leading-relaxed text-justify">
                  {currentSummary}
                </p>
              </section>

              {/* EXPERIENCE TIMELINE */}
              <section className="cv-section" id="section-experience">
                <h2 className="section-title text-xl font-bold text-white tracking-wide uppercase">
                  {isEs ? "Experiencia Laboral" : "Work Experience"}
                </h2>
                <div className="section-divider h-0.5 bg-gradient-to-r from-green-500/50 via-zinc-800 to-transparent mt-2 mb-6" />
                
                <div className="timeline-container space-y-8">
                  {experience.map((job: any, index: number) => (
                    <article key={index} className="experience-item relative pl-6 border-l border-zinc-800 space-y-3">
                      {/* Timeline dot */}
                      <span className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-green-500 border border-zinc-950 shadow-[0_0_8px_rgba(34,197,94,0.6)] no-print"></span>
                      
                      <div className="experience-header flex flex-col md:flex-row md:justify-between md:items-baseline gap-1">
                        <div className="experience-company-role">
                          <h3 className="experience-company text-base md:text-lg font-bold text-white">
                            {job.company}
                          </h3>
                          <span className="experience-role text-sm font-semibold text-green-400 bg-green-500/5 px-2.5 py-0.5 rounded border border-green-500/20 w-fit mt-1">
                            {isEs ? job.role_es : job.role_en}
                          </span>
                        </div>
                        <div className="experience-meta text-xs md:text-sm text-zinc-400 font-mono">
                          <span>{isEs ? job.dates_es : job.dates_en}</span>
                          <span className="mx-2 text-zinc-600">|</span>
                          <span>{isEs ? job.location_es : job.location_en}</span>
                        </div>
                      </div>
                      
                      <ul className="experience-details list-disc pl-4 space-y-2 text-sm text-zinc-300 leading-relaxed">
                        {(isEs ? job.details_es : job.details_en).map((detail: string, dIdx: number) => (
                          <li key={dIdx} className="pl-1">
                            {detail}
                          </li>
                        ))}
                      </ul>
                    </article>
                  ))}
                </div>
              </section>

              {/* SKILLS MATRIX */}
              <section className="cv-section" id="section-skills">
                <h2 className="section-title text-xl font-bold text-white tracking-wide uppercase">
                  {isEs ? "Habilidades" : "Skills"}
                </h2>
                <div className="section-divider h-0.5 bg-gradient-to-r from-green-500/50 via-zinc-800 to-transparent mt-2 mb-6" />
                
                <h3 className="skills-subtitle text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">
                  {isEs ? "Habilidades Técnicas" : "Technical Skills"}
                </h3>
                
                <div className="skills-container grid grid-cols-1 md:grid-cols-2 gap-4">
                  {currentSkillsCategories.map((cat: any, index: number) => (
                    <div key={index} className="skills-category bg-zinc-900/40 border border-zinc-850 p-5 rounded-xl hover:border-green-500/20 transition-all duration-300 space-y-3">
                      <h4 className="skills-category-title text-sm font-bold text-green-400 tracking-wide border-b border-zinc-800/80 pb-2">
                        {cat.name}
                      </h4>
                      <div className="skills-list flex flex-wrap gap-2 pt-1">
                        {cat.items.map((item: string, itemIdx: number) => (
                          <span key={itemIdx} className="skill-tag px-2.5 py-1 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/40 text-xs text-zinc-300 rounded font-mono transition-colors duration-200">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <h3 className="skills-subtitle text-sm font-semibold text-zinc-400 uppercase tracking-wider mt-8 mb-4">
                  {isEs ? "Habilidades Blandas" : "Soft Skills"}
                </h3>
                <div className="skills-list flex flex-wrap gap-2">
                  {currentSoftSkills.map((skill: string, index: number) => (
                    <span key={index} className="skill-tag px-3 py-1.5 bg-zinc-900/60 hover:bg-zinc-800/60 border border-zinc-800 text-xs text-zinc-300 rounded-full transition-colors duration-200">
                      {skill}
                    </span>
                  ))}
                </div>
              </section>

              {/* EDUCATION */}
              <section className="cv-section" id="section-education">
                <h2 className="section-title text-xl font-bold text-white tracking-wide uppercase">
                  {isEs ? "Educación" : "Education"}
                </h2>
                <div className="section-divider h-0.5 bg-gradient-to-r from-green-500/50 via-zinc-800 to-transparent mt-2 mb-6" />
                
                <div className="education-container space-y-6">
                  {education.map((edu: any, index: number) => (
                    <div key={index} className="education-item pl-4 border-l-2 border-green-500/60 space-y-2">
                      <div className="education-header flex flex-col sm:flex-row sm:justify-between sm:items-baseline gap-1">
                        <h3 className="education-degree text-base font-bold text-white">
                          {isEs ? edu.degree_es : edu.degree_en}
                        </h3>
                        <span className="education-year text-xs font-mono text-zinc-400">
                          {edu.year}
                        </span>
                      </div>
                      <div className="education-institution text-sm font-semibold text-green-400">
                        {edu.institution}
                      </div>
                      {(isEs ? edu.description_es : edu.description_en) && (
                        <p className="education-description text-xs text-zinc-400 leading-relaxed max-w-3xl">
                          {isEs ? edu.description_es : edu.description_en}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              {/* CERTIFICATIONS */}
              <section className="cv-section" id="section-certifications">
                <h2 className="section-title text-xl font-bold text-white tracking-wide uppercase">
                  {isEs ? "Certificaciones" : "Certifications"}
                </h2>
                <div className="section-divider h-0.5 bg-gradient-to-r from-green-500/50 via-zinc-800 to-transparent mt-2 mb-6" />
                
                <ul className="certifications-grid grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  {currentCertifications.map((cert: string, index: number) => (
                    <li key={index} className="flex items-start gap-2 bg-zinc-900/30 border border-zinc-850 p-3 rounded-lg hover:border-green-500/10 text-zinc-300">
                      <span className="text-green-500 font-bold no-print select-none">✓</span>
                      <span>{cert}</span>
                    </li>
                  ))}
                </ul>
              </section>

              {/* PRESENTATIONS & TALKS */}
              {currentPresentations && currentPresentations.length > 0 && (
                <section className="cv-section" id="section-presentations">
                  <h2 className="section-title text-xl font-bold text-white tracking-wide uppercase">
                    {isEs ? "Ponencias y Charlas" : "Presentations & Talks"}
                  </h2>
                  <div className="section-divider h-0.5 bg-gradient-to-r from-green-500/50 via-zinc-800 to-transparent mt-2 mb-6" />
                  
                  <div className="presentations-container space-y-6">
                    {currentPresentations.map((pres: any, index: number) => (
                      <div key={index} className="presentation-item pl-4 border-l-2 border-green-500/60 space-y-1">
                        <div className="presentation-header flex flex-col sm:flex-row sm:justify-between sm:items-baseline gap-1">
                          <h3 className="presentation-title-text text-sm md:text-base font-bold text-white">
                            {pres.title}
                          </h3>
                          <span className="presentation-date text-xs font-mono text-zinc-400">
                            {pres.date}
                          </span>
                        </div>
                        <div className="presentation-meta text-xs md:text-sm font-semibold text-green-400">
                          {pres.institution}
                          <span className="presentation-location text-zinc-400 font-normal">
                            {` (${pres.location})`}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* LANGUAGES */}
              <section className="cv-section" id="section-languages">
                <h2 className="section-title text-xl font-bold text-white tracking-wide uppercase">
                  {isEs ? "Idiomas" : "Languages"}
                </h2>
                <div className="section-divider h-0.5 bg-gradient-to-r from-green-500/50 via-zinc-800 to-transparent mt-2 mb-6" />
                
                <div className="languages-container grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {currentLanguages.map((langItem: any, index: number) => (
                    <div key={index} className="language-item bg-zinc-900/40 border border-zinc-850 p-4 rounded-xl flex flex-col items-center justify-center gap-1">
                      <span className="language-name font-bold text-white text-sm">{langItem.language}</span>
                      <span className="language-level text-xs text-green-400 bg-green-500/5 border border-green-500/10 px-2 py-0.5 rounded font-semibold">{langItem.level}</span>
                    </div>
                  ))}
                </div>
              </section>

            </motion.div>
          </AnimatePresence>

        </div>
      </main>

      {/* Footer (Interactive only) */}
      <footer className="no-print w-full max-w-4xl mx-auto px-6 mt-16 text-center text-xs text-zinc-500">
        <p>© 2026 {personal.name}. {isEs ? "Optimizado para lectura digital y análisis ATS." : "Optimized for digital reading and ATS analysis."}</p>
      </footer>
    </div>
  );
}

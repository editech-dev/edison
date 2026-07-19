// src/app/utils/github.ts
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { getCachedData, cacheData } from '@/app/utils/redis';
import fs from 'fs';
import path from 'path';
import { detectLanguage, translateText } from './translation';

// --- Variables de Entorno y Constantes ---
const GITHUB_API_BASE_URL = process.env.GITHUB_API_URL || 'https://api.github.com';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // Tu token de acceso personal de GitHub
const REPO_OWNER = process.env.GITHUB_REPO_OWNER; // Tu nombre de usuario de GitHub

// --- Interfaces ---
export interface GitHubRepository {
  id: number;
  name: string;
  full_name?: string; // Incluido por si acaso
  html_url: string; // URL al repositorio en GitHub
  description: string | null;
  language: string | null;
  stargazers_count: number;
}

export interface BilingualContent {
  description: string | null;
  readme: string | null;
}

export interface BilingualRepository extends GitHubRepository {
  originalLanguage: 'es' | 'en';
  languageChangeNotified?: boolean;
  es: BilingualContent;
  en: BilingualContent;
}

// --- Headers Comunes ---
const commonHeaders: HeadersInit = {
  Accept: 'application/vnd.github.v3+json',
  'X-GitHub-Api-Version': '2022-11-28',
};
if (GITHUB_TOKEN) {
  commonHeaders['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
} else {
  console.warn('Missing GITHUB_TOKEN environment variable. GitHub API rate limits will be lower.');
}

// --- Función para obtener el contenido del README (sin cambios) ---
export const getReadmeContent = cache(async (repoName: string): Promise<string | null> => {
    if (!REPO_OWNER || !repoName) {
        console.error('Missing REPO_OWNER or repoName for getReadmeContent');
        return null;
    }

    const url = `${GITHUB_API_BASE_URL}/repos/${REPO_OWNER}/${repoName}/readme`;
    // Quitamos el log de fetching para no llenar la consola en el bucle
    // console.log(`Workspaceing README from: ${url}`);

    try {
        const response = await fetch(url, {
            headers: {
                ...commonHeaders,
                Accept: 'application/vnd.github.raw+json',
            },
            next: { revalidate: 3600 }
        });

        if (response.ok) {
            const content = await response.text();
            // console.log(`Successfully fetched README content for: ${repoName}`);
            return content;
        } else if (response.status === 404) {
            // console.log(`No README file found for repository: ${repoName}`);
            return null;
        } else {
            // No lanzamos error aquí, simplemente logueamos y retornamos null
            // para que el filtro pueda manejarlo
            console.error(`Failed to fetch README for ${repoName}: ${response.status} ${response.statusText}`);
            // throw new Error(`Failed to fetch README for ${repoName}: ${response.status} ${response.statusText}`);
            return null; // Indica fallo o ausencia de README
        }

    } catch (error) {
        console.error(`Error fetching README for ${repoName} from GitHub:`, error);
        return null; // Error al obtener README
    }
});


// --- Función para procesar la traducción y caché de un repositorio ---
export async function processBilingualRepository(
  repoId: number,
  repoName: string,
  htmlUrl: string,
  programmingLang: string | null,
  stars: number,
  freshDescription: string | null,
  freshReadme: string | null
): Promise<BilingualRepository> {
  const cacheKey = `github:repo:bilingual:${repoName}`;
  const cached: BilingualRepository | null = await getCachedData(cacheKey);

  const cleanDescription = freshDescription || '';
  const cleanReadme = freshReadme || '';
  const combinedContentForDetection = `${cleanDescription}\n\n${cleanReadme}`.trim() || 'No content';

  // 1. Verificar si ya existe en la caché de Redis
  if (cached) {
    const cachedOriginalLang = cached.originalLanguage;
    const cachedOriginalContent = cached[cachedOriginalLang];
    
    // Comparación computacional directa para detectar alteraciones en los caracteres
    const descriptionMatches = (cachedOriginalContent.description || '') === cleanDescription;
    const readmeMatches = (cachedOriginalContent.readme || '') === cleanReadme;

    if (descriptionMatches && readmeMatches) {
      // El contenido no ha cambiado, reutilizamos las traducciones guardadas (Costo de IA: Cero)
      return cached;
    }

    // Caracteres alterados: Re-identificar idioma y reportar si cambió
    console.log(`[Github bilingual cache] Character alterations detected in ${repoName}. Re-detecting language...`);
    const detectedLang = await detectLanguage(combinedContentForDetection);
    let languageChangeNotified = false;

    if (detectedLang !== cachedOriginalLang) {
      console.warn(`[Language Change Warning] Repo "${repoName}" primary language changed from "${cachedOriginalLang}" to "${detectedLang}".`);
      languageChangeNotified = true;
    }

    // Crear su homólogo traduciendo al idioma opuesto
    const oppositeLang = detectedLang === 'es' ? 'en' : 'es';
    console.log(`[Github bilingual cache] Translating altered content of ${repoName} to ${oppositeLang}...`);
    const translatedDescription = cleanDescription 
      ? await translateText(cleanDescription, oppositeLang) 
      : null;
    const translatedReadme = cleanReadme 
      ? await translateText(cleanReadme, oppositeLang) 
      : null;

    const updatedRepo: BilingualRepository = {
      id: repoId,
      name: repoName,
      html_url: htmlUrl,
      language: programmingLang,
      stargazers_count: stars,
      description: freshDescription,
      originalLanguage: detectedLang,
      languageChangeNotified,
      es: {
        description: detectedLang === 'es' ? freshDescription : translatedDescription,
        readme: detectedLang === 'es' ? freshReadme : translatedReadme,
      },
      en: {
        description: detectedLang === 'en' ? freshDescription : translatedDescription,
        readme: detectedLang === 'en' ? freshReadme : translatedReadme,
      }
    };

    // Almacenar en Redis por largo término (30 días)
    await cacheData(cacheKey, updatedRepo, 2592000);
    return updatedRepo;
  }

  // 2. Intentar leer del archivo fallback de pre-traducción estático antes de llamar a la IA
  try {
    const filePath = path.join(process.cwd(), 'src/data/bilingual-repos-fallback.json');
    if (fs.existsSync(filePath)) {
      const fallbackData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const localFallback = fallbackData[repoName];
      if (localFallback) {
        const origLang = localFallback.originalLanguage;
        const origContent = localFallback[origLang];
        
        // Verificar si el fallback coincide con los caracteres actuales de GitHub
        if (origContent.description === freshDescription && origContent.readme === freshReadme) {
          console.log(`[Github bilingual cache] Pre-translated static fallback matches for ${repoName}. Populating Redis cache...`);
          await cacheData(cacheKey, localFallback, 2592000);
          return localFallback;
        }
      }
    }
  } catch (err) {
    console.error(`[Github bilingual cache] Error reading fallback JSON for ${repoName}:`, err);
  }

  // 3. Primer guardado (sin caché ni fallback coincidente): Detectar idioma original e iniciar traducción
  console.log(`[Github bilingual cache] Cache build for ${repoName}. Detecting language...`);
  const detectedLang = await detectLanguage(combinedContentForDetection);
  const oppositeLang = detectedLang === 'es' ? 'en' : 'es';

  console.log(`[Github bilingual cache] Translating first-time content of ${repoName} to ${oppositeLang}...`);
  const translatedDescription = cleanDescription 
    ? await translateText(cleanDescription, oppositeLang) 
    : null;
  const translatedReadme = cleanReadme 
    ? await translateText(cleanReadme, oppositeLang) 
    : null;

  const newRepo: BilingualRepository = {
    id: repoId,
    name: repoName,
    html_url: htmlUrl,
    language: programmingLang,
    stargazers_count: stars,
    description: freshDescription,
    originalLanguage: detectedLang,
    es: {
      description: detectedLang === 'es' ? freshDescription : translatedDescription,
      readme: detectedLang === 'es' ? freshReadme : translatedReadme,
    },
    en: {
      description: detectedLang === 'en' ? freshDescription : translatedDescription,
      readme: detectedLang === 'en' ? freshReadme : translatedReadme,
    }
  };

  await cacheData(cacheKey, newRepo, 2592000);
  return newRepo;
}

// --- Función para obtener y FILTRAR repositorios públicos con soporte bilingüe ---
export const getPublicRepositories = cache(async (): Promise<BilingualRepository[]> => {
  if (!REPO_OWNER) {
    console.error('Missing GITHUB_REPO_OWNER environment variable');
    return [];
  }

  // 1. CHECK REDIS CACHE
  const CACHE_KEY = 'github:repos:public:bilingual';
  const cachedRepos = await getCachedData(CACHE_KEY);
  if (cachedRepos) {
      console.log('Returning bilingual GitHub repositories from Redis Cache');
      return cachedRepos;
  }

  const url = `${GITHUB_API_BASE_URL}/users/${REPO_OWNER}/repos?type=public&sort=updated&per_page=100`;
  console.log(`Fetching public repos list from: ${url}`);

  let initialRepos: GitHubRepository[] = [];

  try {
    const response = await fetch(url, {
      headers: commonHeaders,
      next: { revalidate: 3600 }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch repository list: ${response.status} ${response.statusText}`);
    }

    initialRepos = (await response.json()) as GitHubRepository[];
    console.log(`Fetched ${initialRepos.length} initial public repositories.`);

  } catch (error) {
    console.error('Error fetching initial repository list from GitHub:', error);
    return [];
  }

  // Filtrado por README válido
  console.log('Filtering repositories based on README content and length...');
  const readmeCheckPromises = initialRepos.map(async (repo) => {
    const readmeContent = await getReadmeContent(repo.name);
    return {
      repo,
      readmeContent,
      hasValidReadme: readmeContent !== null && readmeContent.length >= 100
    };
  });

  let reposWithReadmeStatus: Array<{ repo: GitHubRepository; readmeContent: string | null; hasValidReadme: boolean }> = [];
  try {
    reposWithReadmeStatus = await Promise.all(readmeCheckPromises);
  } catch (error) {
      console.error("Error during parallel README fetching:", error);
      return [];
  }

  const filteredRepos = reposWithReadmeStatus.filter(item => item.hasValidReadme);
  console.log(`Finished filtering. Kept ${filteredRepos.length} out of ${initialRepos.length} repositories.`);

  // Procesar secuencialmente (evitar rate limits) las traducciones y la caché bilingüe
  const bilingualRepos: BilingualRepository[] = [];
  for (const item of filteredRepos) {
    try {
      const bilingualRepo = await processBilingualRepository(
        item.repo.id,
        item.repo.name,
        item.repo.html_url,
        item.repo.language,
        item.repo.stargazers_count,
        item.repo.description,
        item.readmeContent
      );
      bilingualRepos.push(bilingualRepo);
    } catch (err) {
      console.error(`Error processing bilingual repository for ${item.repo.name}:`, err);
      // Fallback a un objeto básico bilingüe sin traducción para no bloquear la carga completa
      bilingualRepos.push({
        ...item.repo,
        originalLanguage: 'en',
        es: { description: item.repo.description, readme: item.readmeContent },
        en: { description: item.repo.description, readme: item.readmeContent }
      });
    }
  }

  // CACHE RESULT IN REDIS (1 hora)
  await cacheData(CACHE_KEY, bilingualRepos, 3600);

  return bilingualRepos;
});

// --- Función para obtener detalles de UN repositorio por nombre con soporte bilingüe ---
export const getRepositoryByName = cache(async (repoName: string): Promise<BilingualRepository | null> => {
  if (!REPO_OWNER) {
    console.error('Missing GITHUB_REPO_OWNER environment variable');
    return null;
  }
  if (!repoName) {
    console.error('repoName parameter is missing for getRepositoryByName');
    return null;
  }

  // 1. CHECK REDIS CACHE
  const CACHE_KEY = `github:repo:bilingual:${repoName}`;
  const cachedRepo = await getCachedData(CACHE_KEY);
  if (cachedRepo) {
      console.log(`Returning bilingual details for ${repoName} from Redis Cache`);
      return cachedRepo;
  }

  const url = `${GITHUB_API_BASE_URL}/repos/${REPO_OWNER}/${repoName}`;
  console.log(`Fetching repository details from: ${url}`);

  try {
    const response = await fetch(url, {
      headers: commonHeaders,
      next: { revalidate: 3600 }
    });

    if (response.ok) {
      const repoDetails = (await response.json()) as GitHubRepository;
      const readmeContent = await getReadmeContent(repoName);
      
      console.log(`Successfully fetched details for: ${repoName}. Processing bilingual cache...`);
      const bilingualRepo = await processBilingualRepository(
        repoDetails.id,
        repoDetails.name,
        repoDetails.html_url,
        repoDetails.language,
        repoDetails.stargazers_count,
        repoDetails.description,
        readmeContent
      );
      
      return bilingualRepo;
    } else if (response.status === 404) {
      console.warn(`Repository not found: ${REPO_OWNER}/${repoName}`);
      return null;
    } else {
      throw new Error(`Failed to fetch repository details for ${repoName}: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.error(`Error fetching details for ${repoName} from GitHub:`, error);
    return null;
  }
});
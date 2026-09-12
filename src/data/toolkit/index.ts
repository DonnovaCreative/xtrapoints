import publication from './content.json';

/** Generated publication model. Edit retained masters, then run the builder. */
export const toolkit = publication;
export const toolkitBase = '/resources/ambassador-toolkit';
export type Resource = (typeof publication.resources)[number];
export type Article = (typeof publication.articles)[number];
export const resourceById = (id?: string) => toolkit.resources.find(resource => resource.id === id);
export const articlesFor = (id: string) => toolkit.articles.filter(article => article.resource === id);
export const articleById = (resource: string, id?: string) => toolkit.articles.find(article => article.resource === resource && article.id === id);

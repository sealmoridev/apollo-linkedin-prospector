import { validateLinkedInUrl } from './src/utils/linkedin-validator';

const urls = [
  'https://www.linkedin.com/in/josé-pérez',
  'https://linkedin.com/in/pepe123/',
  'https://www.linkedin.com/in/maria_fernanda',
  'https://www.linkedin.com/pub/ana/1/2/3'
];

urls.forEach(url => {
  console.log(url, '=>', validateLinkedInUrl(url));
});

import dotenv from 'dotenv';
import { EnrichmentService } from './services/enrichment-service';

// Cargar variables de entorno
dotenv.config();

/**
 * Script de ejemplo para probar el enriquecimiento de perfiles de LinkedIn
 */
async function main() {
  const apiKey = process.env.APOLLO_API_KEY;

  if (!apiKey) {
    console.error('❌ Error: APOLLO_API_KEY no está configurada en el archivo .env');
    console.log('\nPor favor:');
    console.log('1. Copia .env.example a .env');
    console.log('2. Agrega tu API key de Apollo.io');
    process.exit(1);
  }

  // Crear servicio de enriquecimiento
  const enrichmentService = new EnrichmentService(apiKey);

  console.log('🚀 Apollo LinkedIn Prospector');
  console.log('================================\n');

  // Ejemplo 1: Enriquecer un solo perfil
  console.log('📋 Ejemplo 1: Enriquecer un perfil individual\n');
  
  try {
    // Reemplaza esta URL con una URL real de LinkedIn que quieras probar
    const testUrl = 'https://www.linkedin.com/in/williamhgates';
    
    console.log(`Enriqueciendo perfil: ${testUrl}\n`);
    
    const lead = await enrichmentService.enrichProfile(testUrl);
    
    console.log('\n📊 Resultado:');
    console.log('─────────────────────────────────────');
    console.log(`Nombre: ${lead.fullName}`);
    console.log(`Email: ${lead.email || 'No disponible'}`);
    console.log(`Título: ${lead.title || 'No disponible'}`);
    console.log(`Empresa: ${lead.company || 'No disponible'}`);
    console.log(`Ubicación: ${lead.location || 'No disponible'}`);
    console.log(`Créditos consumidos: ${lead.creditsConsumed}`);
    console.log('─────────────────────────────────────\n');
  } catch (error) {
    console.error('Error al enriquecer perfil:', error instanceof Error ? error.message : error);
  }

  // Ejemplo 2: Enriquecer múltiples perfiles (batch)
  console.log('\n📋 Ejemplo 2: Enriquecer múltiples perfiles (batch)\n');
  
  try {
    const testUrls = [
      'https://www.linkedin.com/in/williamhgates',
      'https://www.linkedin.com/in/satyanadella',
      'https://www.linkedin.com/in/invalid-profile-xyz-123' // Este fallará
    ];
    
    const result = await enrichmentService.enrichProfiles(testUrls);
    
    console.log('\n📊 Resumen del Batch:');
    console.log('─────────────────────────────────────');
    console.log(`✓ Exitosos: ${result.successful.length}`);
    console.log(`✗ Fallidos: ${result.failed.length}`);
    console.log(`Total créditos: ${result.totalCreditsConsumed}`);
    console.log('─────────────────────────────────────\n');
    
    if (result.successful.length > 0) {
      console.log('Perfiles enriquecidos exitosamente:');
      result.successful.forEach((lead, i) => {
        console.log(`  ${i + 1}. ${lead.fullName} - ${lead.title} @ ${lead.company}`);
      });
    }
    
    if (result.failed.length > 0) {
      console.log('\nPerfiles que fallaron:');
      result.failed.forEach((fail, i) => {
        console.log(`  ${i + 1}. ${fail.linkedinUrl}`);
        console.log(`     Error: ${fail.error}`);
      });
    }
  } catch (error) {
    console.error('Error en batch:', error instanceof Error ? error.message : error);
  }

  console.log('\n✅ Prueba completada\n');
}

// Ejecutar
main().catch(console.error);

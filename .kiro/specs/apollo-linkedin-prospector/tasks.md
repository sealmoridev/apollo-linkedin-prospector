# Implementation Plan: Apollo LinkedIn Prospector

## Overview

Este plan implementa un sistema de prospección multi-usuario que permite a ejecutivos extraer datos de LinkedIn usando Apollo.io y exportarlos a Google Sheets. La implementación se realizará como aplicación web usando Node.js/TypeScript, Express, PostgreSQL, Redis, y las APIs de Apollo.io y Google Sheets.

## Tasks

- [x] 1. Configurar proyecto y estructura base
  - Inicializar proyecto Node.js con TypeScript
  - Configurar ESLint, Prettier, y tsconfig
  - Instalar dependencias: Express, PostgreSQL client (pg), Redis client (ioredis), JWT (jsonwebtoken), bcrypt
  - Crear estructura de directorios: src/{services, routes, models, middleware, utils, types}
  - Configurar variables de entorno con dotenv
  - _Requirements: 8.1, 8.4_

- [ ] 2. Implementar base de datos y migraciones
  - [ ] 2.1 Crear esquema de base de datos PostgreSQL
    - Implementar tablas: users, sessions, google_connections, enriched_leads, activity_logs, system_config
    - Crear índices necesarios
    - _Requirements: 1.4, 3.1, 6.2_
  
  - [ ] 2.2 Configurar pool de conexiones a PostgreSQL
    - Implementar connection pooling con límite de 20 conexiones
    - Agregar health check para DB
    - _Requirements: 8.5_
  
  - [ ] 2.3 Configurar Redis para caching
    - Implementar conexión a Redis
    - Crear utilidades para cache con TTL
    - _Requirements: 3.4_

- [ ] 3. Implementar Authentication Service
  - [ ] 3.1 Crear modelos y tipos de User y Session
    - Definir interfaces TypeScript para User, AuthResponse, LoginCredentials
    - _Requirements: 1.1, 1.4_
  
  - [ ] 3.2 Implementar registro de usuarios
    - Hash de passwords con bcrypt (12 salt rounds)
    - Validación de email y password
    - Insertar usuario en DB
    - _Requirements: 1.1_
  
  - [ ] 3.3 Escribir property test para registro
    - **Property 1: Valid credentials create sessions**
    - **Validates: Requirements 1.1**
  
  - [ ] 3.4 Implementar login y generación de JWT
    - Validar credentials contra DB
    - Generar access token (1h) y refresh token (7d)
    - Crear sesión en DB
    - _Requirements: 1.1_
  
  - [ ] 3.5 Escribir property test para login
    - **Property 2: Invalid credentials are rejected**
    - **Validates: Requirements 1.2**
  
  - [ ] 3.6 Implementar logout y limpieza de sesión
    - Eliminar sesión de DB
    - Invalidar tokens
    - _Requirements: 1.3_
  
  - [ ] 3.7 Escribir property test para logout
    - **Property 3: Logout terminates sessions**
    - **Validates: Requirements 1.3**
  
  - [ ] 3.8 Implementar middleware de autenticación
    - Validar JWT en requests
    - Verificar expiración de sesión
    - Agregar user info a request context
    - _Requirements: 1.5_
  
  - [ ] 3.9 Escribir property test para aislamiento de datos
    - **Property 4: User data isolation**
    - **Validates: Requirements 1.4**

- [ ] 4. Checkpoint - Verificar autenticación
  - Asegurar que todos los tests pasen, preguntar al usuario si surgen dudas.

- [ ] 5. Implementar Enrichment Service
  - [x] 5.1 Crear validador de URLs de LinkedIn
    - Implementar regex para validar formatos de LinkedIn URLs
    - Extraer profile identifier
    - Normalizar URLs
    - _Requirements: 2.1, 2.4_
  
  - [ ] 5.2 Escribir property test para validación de URLs
    - **Property 5: Valid LinkedIn URLs are parsed correctly**
    - **Validates: Requirements 2.1**
  
  - [ ] 5.3 Escribir property test para rechazo de URLs inválidas
    - **Property 6: Invalid URLs are rejected without API calls**
    - **Validates: Requirements 2.4**
  
  - [x] 5.4 Implementar cliente de Apollo.io API
    - Crear función para llamar a /v1/people/match endpoint
    - Configurar headers con API key compartida
    - Implementar parsing de respuestas
    - _Requirements: 2.2, 2.3, 3.2_
  
  - [ ] 5.5 Escribir property test para parsing de respuestas
    - **Property 7: API response parsing consistency**
    - **Validates: Requirements 2.3**
  
  - [ ] 5.6 Implementar caching de perfiles en Redis
    - Cache con key: apollo:profile:{url_hash}
    - TTL de 24 horas
    - Check cache antes de llamar API
    - _Requirements: 2.2_
  
  - [x] 5.7 Implementar función enrichProfile
    - Validar URL
    - Check cache
    - Llamar Apollo API si no está en cache
    - Guardar resultado en DB (enriched_leads)
    - Retornar EnrichedLead
    - _Requirements: 2.1, 2.2, 2.3_
  
  - [ ] 5.8 Implementar función enrichProfiles (batch)
    - Procesar múltiples URLs
    - Deduplicar URLs
    - Procesar en paralelo con Promise.all
    - Retornar resultados y errores separados
    - _Requirements: 2.6_
  
  - [ ] 5.9 Escribir property test para batch processing
    - **Property 8: Batch processing completeness**
    - **Validates: Requirements 2.6**
  
  - [ ] 5.10 Implementar checkCredits
    - Llamar a Apollo API para obtener credit info
    - Cachear resultado (5 min TTL)
    - _Requirements: 3.4_
  
  - [ ] 5.11 Escribir property test para uso de API key compartida
    - **Property 9: Shared API key usage**
    - **Validates: Requirements 3.2**
  
  - [ ] 5.12 Escribir property test para perfiles no encontrados
    - **Property 11: Not-found profiles don't consume credits**
    - **Validates: Requirements 7.3**

- [ ] 6. Implementar manejo de errores y retry logic
  - [ ] 6.1 Implementar retry con exponential backoff
    - Función genérica de retry
    - Máximo 3 intentos
    - Backoff: 1s, 2s, 4s
    - _Requirements: 7.4_
  
  - [ ] 6.2 Escribir property test para retry logic
    - **Property 23: Network error retry with backoff**
    - **Validates: Requirements 7.4**
  
  - [ ] 6.3 Implementar circuit breaker para Apollo API
    - Threshold: 5 fallos consecutivos
    - Timeout: 60 segundos
    - Half-open state con request de prueba
    - _Requirements: 7.1, 7.2_
  
  - [ ] 6.4 Implementar manejo de rate limiting
    - Detectar 429 responses
    - Queue requests con delay
    - _Requirements: 7.1_
  
  - [ ] 6.5 Escribir property test para rate limit queueing
    - **Property 22: Rate limit queueing**
    - **Validates: Requirements 7.1**

- [ ] 7. Checkpoint - Verificar enrichment
  - Asegurar que todos los tests pasen, preguntar al usuario si surgen dudas.

- [ ] 8. Implementar Activity Logger
  - [ ] 8.1 Crear función logEnrichment
    - Insertar log en activity_logs table
    - Incluir: userId, linkedinUrl, success, creditsConsumed, timestamp
    - _Requirements: 6.1_
  
  - [ ] 8.2 Escribir property test para logging completo
    - **Property 18: Complete activity logging**
    - **Validates: Requirements 6.1**
  
  - [ ] 8.3 Crear función logExport
    - Insertar log de exportación
    - _Requirements: 6.1_
  
  - [ ] 8.4 Implementar getUserLogs con filtros
    - Filtrar por userId, dateRange, success
    - Implementar paginación
    - _Requirements: 6.3_
  
  - [ ] 8.5 Escribir property test para filtrado de logs
    - **Property 19: Log filtering accuracy**
    - **Validates: Requirements 6.3**
  
  - [ ] 8.6 Implementar getStatistics
    - Calcular total enrichments, credits consumed
    - Agrupar por usuario
    - _Requirements: 6.4_
  
  - [ ] 8.7 Escribir property test para agregación de créditos
    - **Property 20: Credit aggregation accuracy**
    - **Validates: Requirements 6.4**
  
  - [ ] 8.8 Implementar exportación de logs a CSV
    - Generar CSV con headers
    - Escapar caracteres especiales
    - _Requirements: 6.5_
  
  - [ ] 8.9 Escribir property test para formato CSV
    - **Property 21: CSV export format**
    - **Validates: Requirements 6.5**
  
  - [ ] 8.10 Escribir property test para logging de errores
    - **Property 24: API error logging completeness**
    - **Validates: Requirements 7.5**

- [ ] 9. Implementar Export Service
  - [ ] 9.1 Configurar Google OAuth 2.0
    - Configurar cliente OAuth con googleapis
    - Definir scopes: spreadsheets
    - Implementar redirect URI handler
    - _Requirements: 4.1_
  
  - [ ] 9.2 Implementar connectGoogleAccount
    - Intercambiar auth code por tokens
    - Encriptar tokens con AES-256-GCM
    - Guardar en google_connections table
    - _Requirements: 4.1_
  
  - [ ] 9.3 Implementar listSheets
    - Obtener lista de spreadsheets del usuario
    - Usar Google Drive API
    - _Requirements: 4.2_
  
  - [ ] 9.4 Implementar verificación de permisos
    - Check write permissions en sheet
    - _Requirements: 4.2_
  
  - [ ] 9.5 Escribir property test para verificación de permisos
    - **Property 12: Permission verification before export**
    - **Validates: Requirements 4.2**
  
  - [ ] 9.6 Implementar formateo de datos para export
    - Convertir EnrichedLead[] a formato de filas
    - Aplicar configuración de campos
    - _Requirements: 4.3, 4.6_
  
  - [ ] 9.7 Escribir property test para formateo de datos
    - **Property 13: Data formatting consistency**
    - **Validates: Requirements 4.3**
  
  - [ ] 9.8 Escribir property test para configuración de campos
    - **Property 15: Export field configuration**
    - **Validates: Requirements 4.6**
  
  - [ ] 9.9 Implementar exportLeads
    - Verificar permisos
    - Formatear datos
    - Append a Google Sheet usando batchUpdate
    - Manejar rate limits
    - _Requirements: 4.4, 4.7_
  
  - [ ] 9.10 Escribir property test para append de datos
    - **Property 14: Export appends data correctly**
    - **Validates: Requirements 4.4**
  
  - [ ] 9.11 Escribir property test para batching
    - **Property 16: Batch export operations**
    - **Validates: Requirements 4.7**
  
  - [ ] 9.12 Implementar manejo de errores de export
    - Guardar estado para retry
    - Notificar usuario
    - _Requirements: 4.5_
  
  - [ ] 9.13 Escribir property test para error recovery
    - **Property 17: Export error recovery**
    - **Validates: Requirements 4.5**

- [ ] 10. Checkpoint - Verificar export
  - Asegurar que todos los tests pasen, preguntar al usuario si surgen dudas.

- [ ] 11. Implementar Configuration Service
  - [ ] 11.1 Crear funciones de encriptación/desencriptación
    - Usar crypto module de Node.js
    - AES-256-GCM
    - Key desde variable de entorno
    - _Requirements: 8.4_
  
  - [ ] 11.2 Implementar setApolloApiKey
    - Encriptar key
    - Guardar en system_config table
    - _Requirements: 3.1, 8.2_
  
  - [ ] 11.3 Implementar validateApolloApiKey
    - Hacer test API call a Apollo
    - Verificar respuesta válida
    - _Requirements: 8.2_
  
  - [ ] 11.4 Escribir property test para validación de API key
    - **Property 25: API key validation on update**
    - **Validates: Requirements 8.2**
  
  - [ ] 11.5 Implementar hot-reload de configuración
    - Detectar cambios en system_config
    - Actualizar cache sin restart
    - _Requirements: 8.5_
  
  - [ ] 11.6 Escribir property test para hot-reload
    - **Property 26: Configuration hot-reload**
    - **Validates: Requirements 8.5**

- [ ] 12. Implementar API Routes
  - [ ] 12.1 Crear rutas de autenticación
    - POST /api/auth/register
    - POST /api/auth/login
    - POST /api/auth/logout
    - POST /api/auth/refresh
    - _Requirements: 1.1, 1.2, 1.3_
  
  - [ ] 12.2 Crear rutas de enrichment
    - POST /api/enrich/profile (single)
    - POST /api/enrich/batch (multiple)
    - GET /api/enrich/credits
    - _Requirements: 2.1, 2.2, 2.6, 3.4_
  
  - [ ] 12.3 Crear rutas de export
    - POST /api/export/connect-google
    - GET /api/export/sheets
    - POST /api/export/leads
    - GET /api/export/config
    - PUT /api/export/config
    - _Requirements: 4.1, 4.2, 4.4, 4.6_
  
  - [ ] 12.4 Crear rutas de activity logs
    - GET /api/logs
    - GET /api/logs/statistics
    - GET /api/logs/export-csv
    - _Requirements: 6.3, 6.4, 6.5_
  
  - [ ] 12.5 Crear rutas de configuración (admin only)
    - PUT /api/config/apollo-key
    - PUT /api/config/google-oauth
    - _Requirements: 8.1, 8.2, 8.3_
  
  - [ ] 12.6 Agregar middleware de rate limiting
    - 5 intentos de login por 15 minutos
    - Rate limiting general por IP
    - _Requirements: 1.2_
  
  - [ ] 12.7 Agregar middleware de error handling
    - Formato consistente de errores
    - Logging de errores
    - Request ID para tracking
    - _Requirements: 7.5_

- [ ] 13. Implementar Frontend (React)
  - [ ] 13.1 Configurar proyecto React con TypeScript
    - Vite o Create React App
    - Instalar Tailwind CSS y shadcn/ui
    - Configurar Axios para API calls
    - _Requirements: 5.1_
  
  - [ ] 13.2 Crear componentes de autenticación
    - LoginForm
    - RegisterForm
    - AuthContext para estado global
    - _Requirements: 1.1, 1.2_
  
  - [ ] 13.3 Crear página de enrichment
    - Input para LinkedIn URLs
    - Botón para enrich single/batch
    - Lista de leads procesados
    - Display de créditos restantes
    - Loading indicators
    - _Requirements: 5.1, 5.2, 5.3, 5.7_
  
  - [ ] 13.4 Crear página de export
    - Botón para conectar Google
    - Selector de Google Sheet
    - Configuración de campos de export
    - Botón de export
    - _Requirements: 4.1, 4.2, 4.6, 5.5_
  
  - [ ] 13.5 Crear página de activity logs (admin)
    - Tabla de logs con filtros
    - Estadísticas por usuario
    - Botón de export CSV
    - _Requirements: 6.3, 6.4, 6.5_
  
  - [ ] 13.6 Crear página de configuración (admin)
    - Form para Apollo API key
    - Form para Google OAuth config
    - _Requirements: 8.1, 8.2, 8.3_
  
  - [ ] 13.7 Implementar manejo de errores en UI
    - Toast notifications para errores
    - Display de mensajes descriptivos
    - _Requirements: 2.5, 4.5, 5.4_

- [ ] 14. Integración y testing end-to-end
  - [ ] 14.1 Escribir tests de integración
    - Flujo completo: login → enrich → export
    - Test con Apollo API staging (si disponible)
    - Test con Google Sheets de prueba
    - _Requirements: 1.1, 2.2, 4.4_
  
  - [ ] 14.2 Escribir tests E2E con Playwright
    - Registro de usuario nuevo
    - Enriquecimiento de perfil
    - Exportación a sheet
    - _Requirements: 1.1, 2.1, 4.4_

- [ ] 15. Deployment y documentación
  - [ ] 15.1 Crear Dockerfile
    - Multi-stage build
    - Optimizar tamaño de imagen
    - _Requirements: 8.5_
  
  - [ ] 15.2 Crear docker-compose.yml
    - Servicios: app, postgres, redis
    - Configuración de networking
    - _Requirements: 8.5_
  
  - [ ] 15.3 Configurar variables de entorno
    - Crear .env.example
    - Documentar todas las variables necesarias
    - _Requirements: 8.1, 8.3, 8.4_
  
  - [ ] 15.4 Crear README.md
    - Instrucciones de instalación
    - Configuración de Apollo API key
    - Configuración de Google OAuth
    - Comandos para desarrollo y producción
    - _Requirements: 8.1, 8.2, 8.3_
  
  - [ ] 15.5 Crear documentación de API
    - Endpoints disponibles
    - Request/response examples
    - Códigos de error
    - _Requirements: 1.1, 2.1, 4.1_

- [ ] 16. Checkpoint final
  - Asegurar que todos los tests pasen, verificar que la aplicación funciona end-to-end, preguntar al usuario si surgen dudas.

## Notes

- Todas las tareas son obligatorias para una implementación completa y robusta
- Cada tarea referencia requisitos específicos para trazabilidad
- Los checkpoints aseguran validación incremental
- Los property tests validan propiedades de corrección universales
- Los unit tests validan ejemplos específicos y casos edge
- La implementación sigue una arquitectura de servicios modulares para facilitar testing y mantenimiento

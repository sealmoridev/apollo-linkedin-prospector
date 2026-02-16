# Requirements Document

## Introduction

Sistema de prospección multi-usuario que permite a ejecutivos de ventas extraer información de leads desde perfiles de LinkedIn utilizando la API de Apollo.io (con una API key compartida) y exportar los datos a Google Sheets. El sistema puede implementarse como aplicación web o extensión de Chrome.

## Glossary

- **System**: El sistema completo de prospección Apollo-LinkedIn
- **Apollo_API**: Servicio de API de Apollo.io para enriquecimiento de datos
- **Executive**: Usuario del sistema (ejecutivo de prospección)
- **Lead**: Prospecto cuya información se extrae desde LinkedIn
- **LinkedIn_Profile**: Perfil público de LinkedIn con URL válida
- **Google_Sheet**: Hoja de cálculo de Google Sheets del ejecutivo
- **API_Key**: Clave de API compartida de Apollo.io
- **Credit**: Unidad de consumo de la API de Apollo.io
- **Session**: Sesión autenticada de un ejecutivo en el sistema

## Requirements

### Requirement 1: Autenticación de Ejecutivos

**User Story:** Como administrador del sistema, quiero que múltiples ejecutivos puedan hacer login de forma segura, para que cada uno pueda usar los créditos compartidos de Apollo.io de manera controlada.

#### Acceptance Criteria

1. WHEN an executive provides valid credentials, THE System SHALL authenticate the executive and create a session
2. WHEN an executive attempts login with invalid credentials, THE System SHALL reject the authentication and display an error message
3. WHEN an executive logs out, THE System SHALL terminate the session and clear authentication tokens
4. THE System SHALL maintain separate user profiles for each executive
5. WHEN a session expires, THE System SHALL require re-authentication before allowing further operations

### Requirement 2: Extracción de Datos desde LinkedIn

**User Story:** Como ejecutivo de prospección, quiero extraer información de leads desde URLs de LinkedIn, para que pueda enriquecer mis datos de prospectos usando Apollo.io.

#### Acceptance Criteria

1. WHEN an executive provides a valid LinkedIn profile URL, THE System SHALL extract the profile identifier
2. WHEN an executive submits a LinkedIn URL, THE System SHALL call the Apollo_API to enrich the profile data
3. WHEN the Apollo_API returns lead data, THE System SHALL parse and structure the information (name, email, company, title, location, etc.)
4. IF the LinkedIn URL is invalid or malformed, THEN THE System SHALL display an error message and prevent API calls
5. WHEN the Apollo_API returns an error or no data found, THE System SHALL notify the executive with a descriptive message
6. THE System SHALL support batch processing of multiple LinkedIn URLs simultaneously

### Requirement 3: Gestión de Créditos Compartidos

**User Story:** Como administrador del sistema, quiero que todos los ejecutivos compartan la misma API key de Apollo.io, para que puedan consumir créditos de una cuenta centralizada.

#### Acceptance Criteria

1. THE System SHALL store the Apollo.io API_Key in a secure configuration accessible to all authenticated executives
2. WHEN any executive makes an API request, THE System SHALL use the shared API_Key
3. WHEN an API request is made, THE System SHALL track which executive consumed the credit
4. THE System SHALL display remaining credits available in the shared account
5. IF the shared account has insufficient credits, THEN THE System SHALL prevent new API requests and notify the executive

### Requirement 4: Exportación a Google Sheets

**User Story:** Como ejecutivo de prospección, quiero exportar los datos de leads a mi Google Sheet personal, para que pueda gestionar y hacer seguimiento de mis prospectos.

#### Acceptance Criteria

1. WHEN an executive connects their Google account, THE System SHALL authenticate using OAuth 2.0
2. WHEN an executive selects a Google_Sheet, THE System SHALL verify write permissions
3. WHEN lead data is ready for export, THE System SHALL format the data according to spreadsheet structure (columns: Name, Email, Company, Title, LinkedIn URL, etc.)
4. WHEN an executive triggers export, THE System SHALL append the lead data to the specified Google_Sheet
5. IF the Google Sheets API returns an error, THEN THE System SHALL notify the executive and retain the data for retry
6. THE System SHALL allow executives to configure which data fields to export
7. WHEN exporting multiple leads, THE System SHALL batch the operations to avoid rate limits

### Requirement 5: Interfaz de Usuario

**User Story:** Como ejecutivo de prospección, quiero una interfaz intuitiva para ingresar URLs de LinkedIn y ver los resultados, para que pueda trabajar eficientemente.

#### Acceptance Criteria

1. THE System SHALL provide an input field for LinkedIn profile URLs
2. THE System SHALL display a list of processed leads with their extracted information
3. WHEN processing is in progress, THE System SHALL show loading indicators
4. THE System SHALL display success or error messages for each operation
5. THE System SHALL provide a button to trigger export to Google Sheets
6. WHERE the system is implemented as a Chrome extension, THE System SHALL integrate with the LinkedIn page context
7. THE System SHALL display the current executive's name and remaining shared credits

### Requirement 6: Registro de Actividad

**User Story:** Como administrador del sistema, quiero ver un registro de qué ejecutivo consumió créditos y cuándo, para que pueda auditar el uso de la API compartida.

#### Acceptance Criteria

1. WHEN an executive makes an API request, THE System SHALL log the executive identifier, timestamp, LinkedIn URL, and credits consumed
2. THE System SHALL store activity logs in a persistent data store
3. WHEN an administrator requests activity logs, THE System SHALL display logs filtered by executive, date range, or both
4. THE System SHALL calculate total credits consumed per executive
5. THE System SHALL export activity logs in CSV format

### Requirement 7: Manejo de Errores y Límites de API

**User Story:** Como ejecutivo de prospección, quiero que el sistema maneje errores de API de forma elegante, para que pueda entender qué salió mal y cómo proceder.

#### Acceptance Criteria

1. WHEN the Apollo_API returns a rate limit error, THE System SHALL queue the request for retry after the specified delay
2. WHEN the Apollo_API is unavailable, THE System SHALL display a service unavailable message
3. IF a LinkedIn profile is not found in Apollo.io, THEN THE System SHALL mark the lead as "not found" and not consume credits
4. WHEN network errors occur, THE System SHALL retry the request up to 3 times with exponential backoff
5. THE System SHALL log all API errors with sufficient detail for debugging

### Requirement 8: Configuración del Sistema

**User Story:** Como administrador del sistema, quiero configurar la API key de Apollo.io y otros parámetros, para que el sistema funcione correctamente para todos los ejecutivos.

#### Acceptance Criteria

1. THE System SHALL provide a secure configuration interface for the Apollo.io API_Key
2. WHEN the API_Key is updated, THE System SHALL validate it by making a test API call
3. THE System SHALL allow configuration of Google Sheets OAuth credentials
4. THE System SHALL store all configuration securely with encryption at rest
5. WHERE configuration changes are made, THE System SHALL apply them without requiring system restart

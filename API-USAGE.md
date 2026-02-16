# 📡 Guía de Uso de la API

Una vez desplegado en Railway, puedes usar la API desde cualquier lugar.

## 🌐 URL Base

Reemplaza `YOUR-APP` con tu dominio de Railway:

```
https://YOUR-APP.up.railway.app
```

## 🔑 Endpoints

### 1. Health Check

Verifica que el servidor esté funcionando:

```bash
curl https://YOUR-APP.up.railway.app/health
```

**Respuesta:**
```json
{
  "status": "ok",
  "timestamp": "2024-02-16T10:30:00.000Z",
  "webhookUrl": "https://YOUR-APP.up.railway.app/webhook/apollo"
}
```

### 2. Enriquecer un Perfil (Sin Teléfono)

**Rápido (2-3 segundos)** - No requiere webhook

```bash
curl -X POST https://YOUR-APP.up.railway.app/api/enrich \
  -H "Content-Type: application/json" \
  -d '{
    "linkedinUrl": "https://www.linkedin.com/in/williamhgates",
    "includePhone": false
  }'
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "linkedinUrl": "https://www.linkedin.com/in/williamhgates",
    "firstName": "Bill",
    "lastName": "Gates",
    "fullName": "Bill Gates",
    "email": "be@breakthroughenergy.org",
    "personalEmail": null,
    "phoneNumber": null,
    "title": "Founder",
    "company": "Breakthrough Energy",
    "companyDomain": "breakthroughenergy.org",
    "industry": "management consulting",
    "location": "Seattle, Washington, United States",
    "enrichedAt": "2024-02-16T10:30:00.000Z",
    "creditsConsumed": 1,
    "apolloId": "6867cec58eea26000153fa61"
  }
}
```

### 3. Enriquecer un Perfil (Con Teléfono)

**Lento (30-60 segundos)** - Usa webhook para obtener teléfono

```bash
curl -X POST https://YOUR-APP.up.railway.app/api/enrich \
  -H "Content-Type: application/json" \
  -d '{
    "linkedinUrl": "https://www.linkedin.com/in/williamhgates",
    "includePhone": true
  }'
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "linkedinUrl": "https://www.linkedin.com/in/williamhgates",
    "fullName": "Bill Gates",
    "email": "be@breakthroughenergy.org",
    "phoneNumber": "+1 206 555 0100",
    ...
  }
}
```

### 4. Enriquecer Múltiples Perfiles (Batch)

```bash
curl -X POST https://YOUR-APP.up.railway.app/api/enrich/batch \
  -H "Content-Type: application/json" \
  -d '{
    "linkedinUrls": [
      "https://www.linkedin.com/in/williamhgates",
      "https://www.linkedin.com/in/satyanadella",
      "https://www.linkedin.com/in/jeronimo-horta-scherpf-920036276"
    ],
    "includePhone": false
  }'
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "successful": [
      {
        "fullName": "Bill Gates",
        "email": "be@breakthroughenergy.org",
        ...
      },
      {
        "fullName": "Satya Nadella",
        "email": "satya@uchicago.edu",
        ...
      },
      {
        "fullName": "Jeronimo Horta Scherpf",
        "email": "jeronimo.horta@loreal.com",
        ...
      }
    ],
    "failed": [],
    "totalCreditsConsumed": 3
  }
}
```

## 💻 Ejemplos de Código

### JavaScript / Node.js

```javascript
const axios = require('axios');

const API_URL = 'https://YOUR-APP.up.railway.app';

async function enrichProfile(linkedinUrl, includePhone = false) {
  try {
    const response = await axios.post(`${API_URL}/api/enrich`, {
      linkedinUrl,
      includePhone
    });
    
    return response.data.data;
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    throw error;
  }
}

// Uso
enrichProfile('https://www.linkedin.com/in/williamhgates')
  .then(lead => {
    console.log('Nombre:', lead.fullName);
    console.log('Email:', lead.email);
    console.log('Empresa:', lead.company);
  });
```

### Python

```python
import requests

API_URL = 'https://YOUR-APP.up.railway.app'

def enrich_profile(linkedin_url, include_phone=False):
    response = requests.post(
        f'{API_URL}/api/enrich',
        json={
            'linkedinUrl': linkedin_url,
            'includePhone': include_phone
        }
    )
    response.raise_for_status()
    return response.json()['data']

# Uso
lead = enrich_profile('https://www.linkedin.com/in/williamhgates')
print(f"Nombre: {lead['fullName']}")
print(f"Email: {lead['email']}")
print(f"Empresa: {lead['company']}")
```

### TypeScript

```typescript
interface EnrichRequest {
  linkedinUrl: string;
  includePhone?: boolean;
}

interface EnrichedLead {
  fullName: string;
  email: string;
  title: string;
  company: string;
  location: string;
  phoneNumber?: string;
  // ... otros campos
}

async function enrichProfile(
  linkedinUrl: string,
  includePhone: boolean = false
): Promise<EnrichedLead> {
  const response = await fetch('https://YOUR-APP.up.railway.app/api/enrich', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ linkedinUrl, includePhone }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data.data;
}

// Uso
const lead = await enrichProfile('https://www.linkedin.com/in/williamhgates');
console.log(`${lead.fullName} - ${lead.title} @ ${lead.company}`);
```

### PHP

```php
<?php

function enrichProfile($linkedinUrl, $includePhone = false) {
    $apiUrl = 'https://YOUR-APP.up.railway.app/api/enrich';
    
    $data = [
        'linkedinUrl' => $linkedinUrl,
        'includePhone' => $includePhone
    ];
    
    $options = [
        'http' => [
            'header'  => "Content-type: application/json\r\n",
            'method'  => 'POST',
            'content' => json_encode($data)
        ]
    ];
    
    $context  = stream_context_create($options);
    $result = file_get_contents($apiUrl, false, $context);
    
    return json_decode($result, true)['data'];
}

// Uso
$lead = enrichProfile('https://www.linkedin.com/in/williamhgates');
echo "Nombre: " . $lead['fullName'] . "\n";
echo "Email: " . $lead['email'] . "\n";
?>
```

## 🔄 Batch Processing

### JavaScript

```javascript
async function enrichMultipleProfiles(linkedinUrls) {
  const response = await axios.post(`${API_URL}/api/enrich/batch`, {
    linkedinUrls,
    includePhone: false
  });
  
  const { successful, failed, totalCreditsConsumed } = response.data.data;
  
  console.log(`✅ Exitosos: ${successful.length}`);
  console.log(`❌ Fallidos: ${failed.length}`);
  console.log(`💳 Créditos: ${totalCreditsConsumed}`);
  
  return successful;
}

// Uso
const urls = [
  'https://www.linkedin.com/in/williamhgates',
  'https://www.linkedin.com/in/satyanadella'
];

const leads = await enrichMultipleProfiles(urls);
leads.forEach(lead => {
  console.log(`${lead.fullName} - ${lead.email}`);
});
```

## ⚠️ Manejo de Errores

### Errores Comunes

**400 Bad Request - URL inválida:**
```json
{
  "error": "Invalid LinkedIn URL",
  "details": "URL must be a valid LinkedIn profile URL"
}
```

**400 Bad Request - Parámetro faltante:**
```json
{
  "error": "linkedinUrl is required",
  "example": {
    "linkedinUrl": "https://www.linkedin.com/in/username",
    "includePhone": false
  }
}
```

**500 Internal Server Error:**
```json
{
  "error": "Failed to enrich profile",
  "message": "Apollo API error: Rate limit exceeded"
}
```

### Manejo en Código

```javascript
async function enrichWithErrorHandling(linkedinUrl) {
  try {
    const response = await axios.post(`${API_URL}/api/enrich`, {
      linkedinUrl,
      includePhone: false
    });
    return { success: true, data: response.data.data };
  } catch (error) {
    if (error.response) {
      // Error de la API
      return {
        success: false,
        error: error.response.data.error,
        message: error.response.data.message
      };
    } else {
      // Error de red
      return {
        success: false,
        error: 'Network error',
        message: error.message
      };
    }
  }
}
```

## 📊 Rate Limiting

Apollo.io tiene límites de rate:
- Verifica tu plan en Apollo.io
- Implementa retry logic con exponential backoff
- Usa batch processing cuando sea posible

## 🔐 Seguridad

Para producción, considera:
- Agregar autenticación (API keys, JWT)
- Implementar rate limiting en tu API
- Validar y sanitizar inputs
- Usar HTTPS siempre

## 💡 Tips

1. **Sin teléfono es más rápido**: Si no necesitas teléfonos, usa `includePhone: false`
2. **Batch para múltiples**: Usa `/api/enrich/batch` para procesar varios perfiles
3. **Cache los resultados**: Guarda los resultados para no consumir créditos repetidamente
4. **Maneja timeouts**: Los webhooks pueden tardar, implementa timeouts apropiados

## 🆘 Soporte

Si tienes problemas:
1. Verifica que la URL de Railway sea correcta
2. Revisa los logs en Railway dashboard
3. Verifica que tu API key de Apollo sea válida
4. Consulta [DEPLOY-RAILWAY.md](./DEPLOY-RAILWAY.md) para troubleshooting

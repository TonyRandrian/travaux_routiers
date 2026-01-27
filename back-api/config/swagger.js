const swaggerJsDoc = require('swagger-jsdoc');

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API Travaux Routiers - Antananarivo',
      version: '1.0.0',
      description: 'API REST pour la gestion des signalements de travaux routiers à Antananarivo',
      contact: {
        name: 'Support Technique',
        email: 'support@travaux-routiers.mg'
      }
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Serveur de développement (Docker)'
      },
      {
        url: 'http://localhost:3000',
        description: 'Serveur local (sans Docker)'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Entrez votre token JWT'
        }
      },
      schemas: {
        Utilisateur: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            email: { type: 'string', format: 'email', example: 'user@example.mg' },
            nom: { type: 'string', example: 'Rakoto' },
            prenom: { type: 'string', example: 'Jean' },
            role_code: { type: 'string', enum: ['VISITEUR', 'USER', 'MANAGER'], example: 'USER' },
            role: { type: 'string', example: 'Utilisateur' },
            tentatives: { type: 'integer', example: 0 },
            bloque: { type: 'boolean', example: false },
            created_at: { type: 'string', format: 'date-time' }
          }
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'mot_de_passe'],
          properties: {
            email: { type: 'string', format: 'email', example: 'user@example.mg' },
            mot_de_passe: { type: 'string', example: 'password123' }
          }
        },
        LoginResponse: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Connexion réussie' },
            user: { $ref: '#/components/schemas/Utilisateur' },
            accessToken: { type: 'string', description: 'Token JWT d\'accès' },
            refreshToken: { type: 'string', description: 'Token de rafraîchissement' },
            expiresIn: { type: 'integer', description: 'Durée de validité en secondes', example: 3600 }
          }
        },
        RegisterRequest: {
          type: 'object',
          required: ['email', 'mot_de_passe', 'nom', 'prenom'],
          properties: {
            email: { type: 'string', format: 'email', example: 'nouveau@example.mg' },
            mot_de_passe: { type: 'string', minLength: 6, example: 'password123' },
            nom: { type: 'string', example: 'Rakoto' },
            prenom: { type: 'string', example: 'Jean' }
          }
        },
        RefreshTokenRequest: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: { type: 'string', description: 'Le refresh token obtenu lors de la connexion' }
          }
        },
        Signalement: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            titre: { type: 'string', example: 'Nid de poule Avenue de l\'Indépendance' },
            description: { type: 'string', example: 'Grand nid de poule dangereux' },
            latitude: { type: 'number', format: 'double', example: -18.8792 },
            longitude: { type: 'number', format: 'double', example: 47.5079 },
            surface_m2: { type: 'number', example: 15.5 },
            budget: { type: 'number', example: 2500000 },
            date_signalement: { type: 'string', format: 'date', example: '2026-01-15' },
            statut_code: { type: 'string', enum: ['NOUVEAU', 'EN_COURS', 'TERMINE'], example: 'NOUVEAU' },
            statut: { type: 'string', example: 'Nouveau' },
            entreprise: { type: 'string', example: 'COLAS Madagascar' }
          }
        },
        AuthConfig: {
          type: 'object',
          properties: {
            maxLoginAttempts: { type: 'integer', description: 'Nombre max de tentatives avant blocage', example: 3 },
            sessionDuration: { type: 'integer', description: 'Durée de session en secondes', example: 3600 },
            refreshTokenDuration: { type: 'integer', description: 'Durée du refresh token en secondes', example: 604800 }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Message d\'erreur' },
            code: { type: 'string', example: 'ERROR_CODE' }
          }
        }
      }
    },
    tags: [
      { name: 'Authentification', description: 'Endpoints d\'authentification et gestion des sessions' },
      { name: 'Utilisateurs', description: 'Gestion des utilisateurs' },
      { name: 'Signalements', description: 'Gestion des signalements de travaux routiers' },
      { name: 'Configuration', description: 'Configuration de l\'API' }
    ]
  },
  apis: ['./routes/*.js', './app.js']
};

const swaggerSpec = swaggerJsDoc(swaggerOptions);

module.exports = swaggerSpec;

import { Router, type IRouter } from "express";

const router: IRouter = Router();

const openapiYaml = `openapi: 3.1.0
info:
  title: SSD Klinika API
  version: 2.0.0
  description: |
    Klinika boshqaruv tizimi — to'liq CRUD API.
    Mobil ilovalar va tashqi tizimlar uchun ham mo'ljallangan.

    Autentifikatsiya:
    - Server env \`AUTH_DISABLED=true\` bo'lsa — barcha endpointlar ochiq (dev rejimi).
    - Aks holda har bir so'rovda \`x-api-key: <key>\` yoki \`Authorization: Bearer <key>\` header kerak.
    - \`POST /auth/login\` — foydalanuvchi login qilib mobil API key oladi.
    - \`POST /api-keys\` — admin yangi API key yaratadi (full/readonly/mobile scope).
servers:
  - url: /api
    description: Base
  - url: http://localhost:5000/api
    description: Local dev
security:
  - ApiKeyHeader: []
  - BearerAuth: []
tags:
  - name: health
  - name: auth
  - name: patients
  - name: employees
  - name: appointments
  - name: queue
  - name: service-categories
  - name: services
  - name: assignments
  - name: prescriptions
  - name: treatments
  - name: lab-results
  - name: dental-records
  - name: transactions
  - name: payrolls
  - name: finance
  - name: reports
  - name: roles
  - name: users
  - name: settings
  - name: audit-logs
  - name: api-keys
  - name: promo-codes

paths:
  /healthz:
    get: { tags: [health], summary: Health, security: [], responses: { "200": { description: OK } } }

  /auth/login:
    post:
      tags: [auth]
      summary: Login — returns user and mobile API key
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [username, password]
              properties:
                username: { type: string }
                password: { type: string }
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  user: { $ref: "#/components/schemas/User" }
                  apiKey: { type: string }
        "401": { description: Invalid credentials }

  /patients:
    get:
      tags: [patients]
      summary: List patients
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                type: array
                items: { $ref: "#/components/schemas/Patient" }
    post:
      tags: [patients]
      summary: Create patient (JSHSHIR majburiy)
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: "#/components/schemas/PatientInput" }
      responses:
        "201":
          description: Created
          content:
            application/json:
              schema: { $ref: "#/components/schemas/Patient" }
        "400": { description: "Validatsiya xatoligi (JSHSHIR 14 raqam emas, majburiy maydon bo'sh, va h.k.)" }
        "409": { description: "Bu JSHSHIR bilan bemor allaqachon mavjud" }
  /patients/{id}:
    parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
    get:    { tags: [patients], summary: Get,     responses: { "200": { description: OK }, "404": { description: Not found } } }
    put:
      tags: [patients]
      summary: Replace
      requestBody:
        content:
          application/json:
            schema: { $ref: "#/components/schemas/PatientInput" }
      responses: { "200": { description: OK }, "400": { description: Validation }, "409": { description: Conflict } }
    patch:
      tags: [patients]
      summary: Update (partial)
      requestBody:
        content:
          application/json:
            schema: { $ref: "#/components/schemas/PatientInput" }
      responses: { "200": { description: OK }, "400": { description: Validation }, "409": { description: Conflict } }
    delete: { tags: [patients], summary: Delete,  responses: { "204": { description: Deleted } } }

  /employees:
    get: { tags: [employees], summary: List, responses: { "200": { description: OK } } }
    post: { tags: [employees], summary: Create, responses: { "201": { description: Created } } }
  /employees/{id}:
    parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
    get:    { tags: [employees], responses: { "200": { description: OK } } }
    put:    { tags: [employees], responses: { "200": { description: OK } } }
    patch:  { tags: [employees], responses: { "200": { description: OK } } }
    delete: { tags: [employees], responses: { "204": { description: Deleted } } }

  /appointments:
    get: { tags: [appointments], summary: List, responses: { "200": { description: OK } } }
    post: { tags: [appointments], summary: Create, responses: { "201": { description: Created } } }
  /appointments/{id}:
    parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
    get:    { tags: [appointments], responses: { "200": { description: OK } } }
    put:    { tags: [appointments], responses: { "200": { description: OK } } }
    patch:  { tags: [appointments], responses: { "200": { description: OK } } }
    delete: { tags: [appointments], responses: { "204": { description: Deleted } } }

  /queue:
    get: { tags: [queue], responses: { "200": { description: OK } } }
    post: { tags: [queue], responses: { "201": { description: Created } } }
  /queue/{id}:
    parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
    put:    { tags: [queue], responses: { "200": { description: OK } } }
    patch:  { tags: [queue], responses: { "200": { description: OK } } }
    delete: { tags: [queue], responses: { "204": { description: Deleted } } }

  /service-categories:
    get: { tags: [service-categories], responses: { "200": { description: OK } } }
    post: { tags: [service-categories], responses: { "201": { description: Created } } }
  /service-categories/{id}:
    parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
    put:    { tags: [service-categories], responses: { "200": { description: OK } } }
    patch:  { tags: [service-categories], responses: { "200": { description: OK } } }
    delete: { tags: [service-categories], responses: { "204": { description: Deleted } } }

  /services:
    get: { tags: [services], responses: { "200": { description: OK } } }
    post: { tags: [services], responses: { "201": { description: Created } } }
  /services/{id}:
    parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
    put:    { tags: [services], responses: { "200": { description: OK } } }
    patch:  { tags: [services], responses: { "200": { description: OK } } }
    delete: { tags: [services], responses: { "204": { description: Deleted } } }

  /assignments:
    get: { tags: [assignments], responses: { "200": { description: OK } } }
  /assignments/toggle:
    post:
      tags: [assignments]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [employeeId, serviceId]
              properties:
                employeeId: { type: string }
                serviceId: { type: string }
      responses: { "200": { description: OK } }
  /assignments/{employeeId}:
    parameters: [{ in: path, name: employeeId, required: true, schema: { type: string } }]
    put:
      tags: [assignments]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                serviceIds: { type: array, items: { type: string } }
      responses: { "200": { description: OK } }

  /prescriptions:
    get: { tags: [prescriptions], responses: { "200": { description: OK } } }
    post: { tags: [prescriptions], responses: { "201": { description: Created } } }
  /prescriptions/{id}:
    parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
    get:    { tags: [prescriptions], responses: { "200": { description: OK } } }
    put:    { tags: [prescriptions], responses: { "200": { description: OK } } }
    patch:  { tags: [prescriptions], responses: { "200": { description: OK } } }
    delete: { tags: [prescriptions], responses: { "204": { description: Deleted } } }

  /treatments:
    get: { tags: [treatments], responses: { "200": { description: OK } } }
    post: { tags: [treatments], responses: { "201": { description: Created } } }
  /treatments/{id}:
    parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
    get:    { tags: [treatments], responses: { "200": { description: OK } } }
    put:    { tags: [treatments], responses: { "200": { description: OK } } }
    patch:  { tags: [treatments], responses: { "200": { description: OK } } }
    delete: { tags: [treatments], responses: { "204": { description: Deleted } } }

  /lab-results:
    get: { tags: [lab-results], responses: { "200": { description: OK } } }
    post: { tags: [lab-results], responses: { "201": { description: Created } } }
  /lab-results/{id}:
    parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
    get:    { tags: [lab-results], responses: { "200": { description: OK } } }
    put:    { tags: [lab-results], responses: { "200": { description: OK } } }
    patch:  { tags: [lab-results], responses: { "200": { description: OK } } }
    delete: { tags: [lab-results], responses: { "204": { description: Deleted } } }

  /dental-records:
    get: { tags: [dental-records], responses: { "200": { description: OK } } }
    post: { tags: [dental-records], responses: { "201": { description: Created } } }
  /dental-records/{id}:
    parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
    get:    { tags: [dental-records], responses: { "200": { description: OK } } }
    put:    { tags: [dental-records], responses: { "200": { description: OK } } }
    patch:  { tags: [dental-records], responses: { "200": { description: OK } } }
    delete: { tags: [dental-records], responses: { "204": { description: Deleted } } }

  /transactions:
    get: { tags: [transactions], responses: { "200": { description: OK } } }
    post: { tags: [transactions], responses: { "201": { description: Created } } }
  /transactions/{id}:
    parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
    get:    { tags: [transactions], responses: { "200": { description: OK } } }
    put:    { tags: [transactions], responses: { "200": { description: OK } } }
    patch:  { tags: [transactions], responses: { "200": { description: OK } } }
    delete: { tags: [transactions], responses: { "204": { description: Deleted } } }

  /payrolls:
    get: { tags: [payrolls], responses: { "200": { description: OK } } }
    post: { tags: [payrolls], responses: { "201": { description: Created } } }
  /payrolls/{id}:
    parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
    put:    { tags: [payrolls], responses: { "200": { description: OK } } }
    patch:  { tags: [payrolls], responses: { "200": { description: OK } } }
    delete: { tags: [payrolls], responses: { "204": { description: Deleted } } }

  /finance/summary:
    get: { tags: [finance], summary: "Income/expense summary", responses: { "200": { description: OK } } }

  /reports/overview:
    get: { tags: [reports], summary: "Dashboard KPI", responses: { "200": { description: OK } } }
  /reports/appointments-by-status:
    get: { tags: [reports], responses: { "200": { description: OK } } }
  /reports/top-services:
    get: { tags: [reports], responses: { "200": { description: OK } } }

  /roles:
    get: { tags: [roles], responses: { "200": { description: OK } } }
    post: { tags: [roles], responses: { "201": { description: Created } } }
  /roles/{id}:
    parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
    patch:  { tags: [roles], responses: { "200": { description: OK } } }
    delete: { tags: [roles], responses: { "204": { description: Deleted } } }

  /users:
    get: { tags: [users], responses: { "200": { description: OK } } }
    post:
      tags: [users]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [username, password, fullName]
              properties:
                username: { type: string }
                password: { type: string }
                fullName: { type: string }
                roleId: { type: string }
                employeeId: { type: string }
      responses: { "201": { description: Created } }
  /users/{id}:
    parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
    patch:  { tags: [users], responses: { "200": { description: OK } } }
    delete: { tags: [users], responses: { "204": { description: Deleted } } }

  /settings:
    get: { tags: [settings], responses: { "200": { description: OK } } }
  /settings/{key}:
    parameters: [{ in: path, name: key, required: true, schema: { type: string } }]
    get:    { tags: [settings], responses: { "200": { description: OK } } }
    put:    { tags: [settings], summary: "Upsert setting", responses: { "200": { description: OK } } }
    delete: { tags: [settings], responses: { "204": { description: Deleted } } }

  /audit-logs:
    get: { tags: [audit-logs], responses: { "200": { description: OK } } }
    post: { tags: [audit-logs], responses: { "201": { description: Created } } }

  /api-keys:
    get: { tags: [api-keys], responses: { "200": { description: OK } } }
    post:
      tags: [api-keys]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                name: { type: string }
                scope: { type: string, enum: [full, readonly, mobile] }
      responses: { "201": { description: Created } }
  /api-keys/{id}:
    parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
    delete: { tags: [api-keys], responses: { "204": { description: Deleted } } }

  /promo-codes:
    get:  { tags: [promo-codes], summary: List, responses: { "200": { description: OK } } }
    post:
      tags: [promo-codes]
      summary: Create promo code
      requestBody:
        content:
          application/json:
            schema: { $ref: "#/components/schemas/PromoCode" }
      responses: { "201": { description: Created } }
  /promo-codes/{id}:
    parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
    get:    { tags: [promo-codes], responses: { "200": { description: OK } } }
    patch:  { tags: [promo-codes], responses: { "200": { description: OK } } }
    delete: { tags: [promo-codes], responses: { "204": { description: Deleted } } }
  /promo-codes/by-code/{code}:
    parameters: [{ in: path, name: code, required: true, schema: { type: string } }]
    get: { tags: [promo-codes], summary: Lookup by code, responses: { "200": { description: OK }, "404": { description: Not found } } }
  /promo-codes/{id}/mark-used:
    parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
    post:
      tags: [promo-codes]
      summary: Mark promo as used
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                paymentId: { type: string }
      responses: { "200": { description: OK } }

components:
  securitySchemes:
    ApiKeyHeader:
      type: apiKey
      in: header
      name: x-api-key
    BearerAuth:
      type: http
      scheme: bearer
  schemas:
    User:
      type: object
      properties:
        id: { type: string }
        username: { type: string }
        fullName: { type: string }
        roleId: { type: string, nullable: true }
        employeeId: { type: string, nullable: true }
        active: { type: boolean }

    Patient:
      type: object
      properties:
        id: { type: string, description: "UUID" }
        fullName: { type: string }
        phone: { type: string }
        address: { type: string }
        region: { type: string, nullable: true }
        district: { type: string, nullable: true }
        gender: { type: string, enum: [erkak, ayol], nullable: true }
        birthDate: { type: string, format: date, nullable: true }
        jshshir:
          type: string
          nullable: true
          minLength: 14
          maxLength: 14
          pattern: '^[0-9]{14}$'
          description: "Jismoniy shaxsning shaxsiy identifikatsiya raqami — aniq 14 ta raqam, takrorlanmaydi."
        addedAt: { type: integer, format: int64 }
        archived: { type: boolean }

    PatientInput:
      type: object
      required: [fullName, phone, gender, birthDate, jshshir]
      properties:
        fullName: { type: string }
        phone: { type: string }
        gender: { type: string, enum: [erkak, ayol] }
        birthDate: { type: string, format: date }
        jshshir:
          type: string
          minLength: 14
          maxLength: 14
          pattern: '^[0-9]{14}$'
          description: "Majburiy — aniq 14 raqam"
        address: { type: string }
        region: { type: string }
        district: { type: string }

    PromoCode:
      type: object
      properties:
        id: { type: string }
        code: { type: string }
        amount: { type: integer }
        percent: { type: integer }
        patientId: { type: string, nullable: true }
        patientName: { type: string, nullable: true }
        paymentId: { type: string, nullable: true }
        createdAt: { type: integer, format: int64 }
        expiresAt: { type: integer, format: int64 }
        usedAt: { type: integer, format: int64, nullable: true }
        usedPaymentId: { type: string, nullable: true }
`;

const swaggerHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>SSD Klinika API - Swagger UI</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css">
  <style>body { margin: 0; } #swagger-ui { max-width: 1200px; margin: 0 auto; }</style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '/api/openapi.yaml',
        dom_id: '#swagger-ui',
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
        layout: 'StandaloneLayout',
        deepLinking: true,
        persistAuthorization: true,
      });
    };
  </script>
</body>
</html>`;

router.get("/openapi.yaml", (_req, res) => {
  res.type("application/yaml").send(openapiYaml);
});

router.get("/openapi.json", async (_req, res) => {
  try {
    const yaml: any = await import("js-yaml" as any);
    res.json(yaml.load(openapiYaml));
  } catch {
    res.type("application/yaml").send(openapiYaml);
  }
});

router.get("/docs", (_req, res) => {
  res.type("html").send(swaggerHtml);
});

export default router;

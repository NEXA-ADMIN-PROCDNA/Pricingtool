# ── Stage 1: install dependencies ────────────────────────────────────────────
# Copying package files first means this layer is cached by Docker and only
# re-runs when package.json / package-lock.json actually change.
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# ── Stage 2: build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Bring in installed node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Now copy all source files (invalidates only when source changes, not deps)
COPY . .

# # Build args passed in at build time (e.g. docker build --build-arg ...)
# # Required so Next.js can inline NEXT_PUBLIC_* values at build time.
# ARG DATABASE_URL
# ARG NEXTAUTH_URL
# ARG NEXTAUTH_SECRET
# ARG AZURE_AD_CLIENT_ID
# ARG AZURE_AD_CLIENT_SECRET
# ARG AZURE_AD_TENANT_ID
# ARG SUPABASE_URL
# ARG SUPABASE_SERVICE_ROLE_KEY
# ARG NEXT_PUBLIC_SUPABASE_URL
# ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
# ARG MAIL_SENDER
# ARG MAIL_BASE_URL
# ARG EMAIL_ACTION_SECRET
# ARG CREDENTIALS_SECRET
# ARG ONEDRIVE_USER
# ARG ONEDRIVE_FILE_PATH

# ENV DATABASE_URL=$DATABASE_URL \
#     NEXTAUTH_URL=$NEXTAUTH_URL \
#     NEXTAUTH_SECRET=$NEXTAUTH_SECRET \
#     AZURE_AD_CLIENT_ID=$AZURE_AD_CLIENT_ID \
#     AZURE_AD_CLIENT_SECRET=$AZURE_AD_CLIENT_SECRET \
#     AZURE_AD_TENANT_ID=$AZURE_AD_TENANT_ID \
#     SUPABASE_URL=$SUPABASE_URL \
#     SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY \
#     NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
#     NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
#     MAIL_SENDER=$MAIL_SENDER \
#     MAIL_BASE_URL=$MAIL_BASE_URL \
#     EMAIL_ACTION_SECRET=$EMAIL_ACTION_SECRET \
#     CREDENTIALS_SECRET=$CREDENTIALS_SECRET \
#     ONEDRIVE_USER=$ONEDRIVE_USER \
#     ONEDRIVE_FILE_PATH=$ONEDRIVE_FILE_PATH

# prisma generate must run before next build (also runs via postinstall but
# making it explicit here ensures the generated client is always fresh).
RUN npx prisma generate && npm run build

# ── Stage 3: production runner ────────────────────────────────────────────────
# output: 'standalone' in next.config.ts makes Next.js emit a self-contained
# server bundle under .next/standalone — no full node_modules needed at runtime.
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid  1001 nextjs

# Copy the standalone server bundle
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# Copy static assets (not included in standalone bundle)
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]

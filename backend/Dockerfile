# Build and run the EcoCycle ASP.NET Core API.
#
# Build context is this folder (backend/), so on Render set:
#   Root Directory   = backend
#   Dockerfile Path  = ./Dockerfile
#
# Configuration comes from environment variables, not a .env file -- Program.cs
# reads a .env when one is present for local development, and falls back to the
# real environment otherwise. The container needs at least:
#   SUPABASE_CONNECTION_STRING, SUPABASE_URL, SUPABASE_JWT_SECRET,
#   ALLOWED_ORIGINS, AGENT_SERVICE_URL, INTERNAL_API_KEY

# ---------- build ----------
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Restore first, with only the project file copied, so the restore layer is
# cached and does not re-run every time source changes.
COPY backend.csproj ./
RUN dotnet restore

COPY . ./
RUN dotnet publish backend.csproj -c Release -o /app/publish --no-restore

# ---------- run ----------
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish ./

# Render (and most hosts) inject the port to listen on as $PORT and route to it.
# 8080 is the fallback for running the image locally.
ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080

# Shell form on purpose: $PORT has to be expanded at container start, not at
# build time. Binding 0.0.0.0 rather than localhost is what makes the app
# reachable from outside the container.
CMD ASPNETCORE_URLS=http://0.0.0.0:${PORT:-8080} dotnet backend.dll

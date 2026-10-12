# Build stage: restore and publish with the full SDK.
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Project file first, so the restore layer is cached until a dependency changes.
COPY global.json ./
COPY src/CryptoToolkit.Web/CryptoToolkit.Web.csproj src/CryptoToolkit.Web/
RUN dotnet restore src/CryptoToolkit.Web/CryptoToolkit.Web.csproj

COPY src/ src/
RUN dotnet publish src/CryptoToolkit.Web/CryptoToolkit.Web.csproj -c Release -o /app --no-restore /p:UseAppHost=false

# Runtime stage: only the ASP.NET runtime, running as the image's non-root "app" user.
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app .

ENV ASPNETCORE_ENVIRONMENT=Production \
    # Workstation GC keeps memory low on a 512 MB instance.
    DOTNET_gcServer=0
USER $APP_UID
EXPOSE 8080

# Render passes the port to listen on in $PORT.
ENTRYPOINT ["sh", "-c", "ASPNETCORE_HTTP_PORTS=${PORT:-8080} exec dotnet CryptoToolkit.Web.dll"]

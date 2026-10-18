using Npgsql;

namespace AcmeCommerce.Api;

internal static class NeonConnectionString
{
    public static string FromUrl(string databaseUrl)
    {
        if (!Uri.TryCreate(databaseUrl, UriKind.Absolute, out var uri) ||
            (uri.Scheme != "postgres" && uri.Scheme != "postgresql") ||
            !uri.Host.EndsWith(".neon.tech", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Neon:DatabaseUrl must be a Neon PostgreSQL URL.");

        var credentials = uri.UserInfo.Split(':', 2);
        var database = Uri.UnescapeDataString(uri.AbsolutePath.TrimStart('/'));
        if (credentials.Length != 2 || string.IsNullOrWhiteSpace(credentials[0]) ||
            string.IsNullOrWhiteSpace(credentials[1]) || string.IsNullOrWhiteSpace(database))
            throw new InvalidOperationException("Neon:DatabaseUrl must include a user, password and database.");

        var connection = new NpgsqlConnectionStringBuilder
        {
            Host = uri.Host,
            Port = uri.IsDefaultPort ? 5432 : uri.Port,
            Database = database,
            Username = Uri.UnescapeDataString(credentials[0]),
            Password = Uri.UnescapeDataString(credentials[1]),
            SslMode = SslMode.VerifyFull,
            Timeout = 15,
            CommandTimeout = 15,
            MaxPoolSize = 5,
            MinPoolSize = 0,
        };
        connection["Channel Binding"] = "Require";
        return connection.ConnectionString;
    }
}

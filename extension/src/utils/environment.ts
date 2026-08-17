import { EnvVar } from "../dcp/types";

const filteredEnvironmentKeyCounts = new Map<string, number>();

export function mergeEnvs(base: NodeJS.ProcessEnv, envVars?: EnvVar[]): Record<string, string | undefined> {
    const merged: Record<string, string | undefined> = { ...base };
    if (envVars) {
        for (const e of envVars) {
            merged[e.name] = e.value;
        }
    }
    return merged;
}

export function getEnvironmentWithoutE2EBridgeVariables(): NodeJS.ProcessEnv {
    return Object.fromEntries(
        Object.entries(process.env).filter(([key]) => !key.startsWith('ASPIRE_EXTENSION_E2E_') && !filteredEnvironmentKeyCounts.has(key))
    );
}

export function addFilteredEnvironmentKeys(keys: string[]): void {
    for (const key of keys) {
        filteredEnvironmentKeyCounts.set(key, (filteredEnvironmentKeyCounts.get(key) ?? 0) + 1);
    }
}

export function removeFilteredEnvironmentKeys(keys: string[]): void {
    for (const key of keys) {
        const count = filteredEnvironmentKeyCounts.get(key);
        if (count === undefined) {
            continue;
        }

        if (count <= 1) {
            filteredEnvironmentKeyCounts.delete(key);
        } else {
            filteredEnvironmentKeyCounts.set(key, count - 1);
        }
    }
}

export const enum EnvironmentVariables {
    ASPIRE_CLI_STOP_ON_ENTRY = "ASPIRE_CLI_STOP_ON_ENTRY",
    ASPIRE_APPHOST_STOP_ON_ENTRY = "ASPIRE_APPHOST_STOP_ON_ENTRY",
    ASPIRE_CLI_START_TIMEOUT = "ASPIRE_CLI_START_TIMEOUT",
    ASPIRE_CLI_BACKCHANNEL_CONNECT_TIMEOUT_SECONDS = "ASPIRE_CLI_BACKCHANNEL_CONNECT_TIMEOUT_SECONDS",
    ASPIRE_CLI_APPHOST_SELECTION_ORIGIN = "ASPIRE_CLI_APPHOST_SELECTION_ORIGIN",
    ASPIRE_NON_INTERACTIVE = "ASPIRE_NON_INTERACTIVE"
}

export function configureDebugTimeoutEnvironment(env: Record<string, string | undefined>, noDebug?: boolean): void {
    if (noDebug !== false) {
        return;
    }

    const configuredStartupTimeout = getConfiguredEnvironmentVariable(env, EnvironmentVariables.ASPIRE_CLI_START_TIMEOUT);
    // A developer can pause before builder.Build() for an arbitrarily long time. Keep the
    // extension-managed debug session alive for up to 24 hours unless the user chose a value.
    const effectiveStartupTimeout = configuredStartupTimeout ?? '86400';
    if (configuredStartupTimeout === undefined) {
        env[EnvironmentVariables.ASPIRE_CLI_START_TIMEOUT] = effectiveStartupTimeout;
    }

    // Aspire 13.3.5 does not derive its backchannel deadline from the startup timeout.
    // Supply the legacy override for older installed CLIs while preserving explicit values.
    if (getConfiguredEnvironmentVariable(env, EnvironmentVariables.ASPIRE_CLI_BACKCHANNEL_CONNECT_TIMEOUT_SECONDS) === undefined) {
        env[EnvironmentVariables.ASPIRE_CLI_BACKCHANNEL_CONNECT_TIMEOUT_SECONDS] = effectiveStartupTimeout;
    }
}

export const nonInteractiveCliEnvironment: EnvVar[] = [
    { name: EnvironmentVariables.ASPIRE_NON_INTERACTIVE, value: 'true' },
];

function getConfiguredEnvironmentVariable(env: Record<string, string | undefined>, name: string): string | undefined {
    if (env[name]) {
        return env[name];
    }

    if (process.platform !== 'win32') {
        return undefined;
    }

    // Windows environment variables are case-insensitive. Avoid adding a second
    // differently-cased key because Node picks only one when spawning the child process.
    return Object.entries(env).find(([key, value]) => key.toUpperCase() === name && !!value)?.[1];
}

/* eslint-disable import/no-extraneous-dependencies */
import spawn from 'cross-spawn'
import { readFileSync } from 'node:fs'
import type { PackageManager } from './get-pkg-manager'

/**
 * Whether `next typegen` can run in the directory of `packageJsonPath`.
 * Workspace examples keep `next` in an app package rather than at the root,
 * where running it only prints a "command not found" error.
 */
export function hasNextDependency(packageJsonPath: string): boolean {
  try {
    const { dependencies, devDependencies } = JSON.parse(
      readFileSync(packageJsonPath, 'utf8')
    )
    return Boolean(dependencies?.next || devDependencies?.next)
  } catch {
    return false
  }
}

/**
 * Runs `next typegen` using the package manager to execute the locally installed Next.js binary.
 * Assumes the current working directory is the project root where Next is installed.
 */
export async function runTypegen(
  packageManager: PackageManager
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Determine the command and arguments based on the package manager
    let command: string
    let args: string[]

    switch (packageManager) {
      case 'npm':
        command = 'npm'
        args = ['exec', 'next', '--', 'typegen']
        break
      case 'yarn':
        command = 'yarn'
        args = ['exec', 'next', '--', 'typegen']
        break
      case 'pnpm':
        command = 'pnpm'
        args = ['exec', 'next', '--', 'typegen']
        break
      case 'bun':
        command = 'bun'
        // Bun only has `bun x` which is not the same thing.
        // We need to hope Bun never implements their own `bun next`.
        args = ['next', 'typegen']
        break
      default:
        packageManager satisfies never
        throw new Error(`Unsupported package manager: ${packageManager}`)
    }

    const child = spawn(command, args, {
      stdio: 'inherit',
      env: {
        ...process.env,
      },
    })

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`next typegen exited with code ${code}`))
        return
      }
      resolve()
    })
  })
}

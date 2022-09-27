import {readdirSync, readFileSync, statSync, writeFileSync} from 'fs'
import {resolve, join} from 'path'

const SOLIDITY_COMPILER_VERSION = "=0.7.6"
const OPEN_ZEP_PACKAGE = '@openzeppelin3.4.2'
const V3_CORE_PACKAGE = '@birthdayresearch/uniswap-v3-core'
// Where to start walking from
const START_PATH = resolve('./')
// Directories to ignore. This is a naive search, similar to a **directory** glob
const TO_IGNORE = ['node_modules', 'typechain', 'artifacts', 'git', '.idea']

walk(START_PATH, formatFile)

// Recursively apply a function to every file.
function walk(dirPath: string, cb: (filePath: string) => void) {
  for (const entry of readdirSync(dirPath)) {
    const qualifiedPath = join(dirPath, entry)

    if (isIgnoredDirectory(dirPath)) {
      continue
    }

    const metadata = statSync(qualifiedPath)

    if (metadata.isFile()) {
      cb(qualifiedPath)
    }

    if (metadata.isDirectory()) {
      walk(qualifiedPath, cb)
    }
  }
}

function formatFile(filePath: string) {
  if (filePath.endsWith('.sol')) {
    handleSolidityFile(filePath)
  }

  if (filePath.endsWith('.ts')) {
    handleTSFile(filePath)
  }
}

function handleSolidityFile(filePath: string) {
  const fileContents = readFileSync(filePath, {encoding: 'utf-8'})
  const fileLines = fileContents.split('\n')
  const fileLinesCopy = [...fileLines]
  let changeMade = false

  for (let i = 0; i < fileLines.length; i++) {
    const line = fileLines[i]
    // If the line starts with `pragma solidity` but does not end with the version that we want,
    // we need to overwrite the version.
    if (line.startsWith('pragma solidity') && !line.endsWith(`${SOLIDITY_COMPILER_VERSION};`)) {
      fileLinesCopy[i] = `pragma solidity ${SOLIDITY_COMPILER_VERSION};`
      changeMade = true
    }

    if (line.includes('@birthdaycloud/uniswap-v3-core')) {
      fileLinesCopy[i] = line.replace('@birthdaycloud/uniswap-v3-core', V3_CORE_PACKAGE)
      changeMade = true
    }

    // Do not overwrite if the right openzeppelin package is already used
    if (line.includes('@openzeppelin')  && !line.includes(OPEN_ZEP_PACKAGE)) {
      fileLinesCopy[i] = line.replace('@openzeppelin', OPEN_ZEP_PACKAGE)
      changeMade = true
    }

    // Reached the opening brace where imports and versioning ends, can save the file now
    if (line.includes('{')) {
      if (changeMade) {
        const newFile = fileLinesCopy.join('\n')
        writeFileSync(filePath, newFile, 'utf-8')
      }
      return
    }
  }
}

function handleTSFile(filePath: string) {
  const fileContents = readFileSync(filePath, {encoding: 'utf-8'})
  const fileLines = fileContents.split('\n')
  const fileLinesCopy = [...fileLines]
  let changeMade = false

  for (let i = 0; i < fileLines.length; i++) {
    const line = fileLines[i]

    // Shorter imports start with the word import
    // Longer imports are formatted, and the line which includes the package looks like
    // } from '@some-package-name'
    if (line.startsWith('import') || line.startsWith('}')) {
      if (line.includes('@birthdaycloud/uniswap-v3-core')) {
        fileLinesCopy[i] = line.replace('@birthdaycloud/uniswap-v3-core', V3_CORE_PACKAGE)
        changeMade = true
      }

      // Do not overwrite if the right openzeppelin package is already used
      if (line.includes('@openzeppelin') && !line.includes(OPEN_ZEP_PACKAGE)) {
        fileLinesCopy[i] = line.replace('@openzeppelin', OPEN_ZEP_PACKAGE)
        changeMade = true
      }
    }

    // not able to have early return since we have no way of knowing when the imports
    // end and the code starts
  }

  if (changeMade) {
    const newFile = fileLinesCopy.join('\n')
    writeFileSync(filePath, newFile, 'utf-8')
  }
}

// This is a naive search, similar to a **directory** glob
function isIgnoredDirectory(dirPath: string): boolean {
  return TO_IGNORE.some((ignoredPath: string) => dirPath.includes(ignoredPath))
}

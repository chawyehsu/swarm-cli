import { existsSync, unlinkSync } from 'fs'
import { cli } from 'furious-commander'
import { join } from 'path'
import { Upload } from '../../src/command/upload'
import { optionParameters, rootCommandClasses } from '../../src/config'
import { getStampOption } from '../utility/stamp'

async function uploadAndGetHash(path: string, indexDocument?: string): Promise<string> {
  const extras = indexDocument ? ['--index-document', indexDocument] : []
  const builder = await cli({
    rootCommandClasses,
    optionParameters,
    testArguments: ['upload', path, ...getStampOption(), ...extras],
  })
  const { hash } = builder.runnable as Upload

  return hash
}

describe('Test Pinning command', () => {
  const configFolderPath = join(__dirname, '..', 'testconfig')
  const configFileName = 'pinning.config.json'
  const configFilePath = join(configFolderPath, configFileName)
  let consoleMessages: string[] = []

  beforeAll(() => {
    global.console.log = jest.fn(message => {
      consoleMessages.push(message)
    })
    jest.spyOn(global.console, 'warn')
    //set config environment variable
    process.env.SWARM_CLI_CONFIG_FOLDER = configFolderPath
    process.env.SWARM_CLI_CONFIG_FILE = configFileName

    //remove config file if it exists
    if (existsSync(configFilePath)) unlinkSync(configFilePath)
  })

  beforeEach(() => {
    //clear stored console messages
    consoleMessages = []
  })

  it('should pin a collection with index.html index document', async () => {
    const hash = await uploadAndGetHash('test/testpage')
    expect(hash).toMatch(/[a-z0-9]{64}/)
    await cli({
      rootCommandClasses,
      optionParameters,
      testArguments: ['pinning', 'pin', hash],
    })
    expect(consoleMessages).toHaveLength(4)
    expect(consoleMessages[3]).toBe('Pinned successfully')
  })

  it('should pin a collection with no index document', async () => {
    const hash = await uploadAndGetHash('test/command')
    expect(hash).toMatch(/[a-z0-9]{64}/)
    await cli({
      rootCommandClasses,
      optionParameters,
      testArguments: ['pinning', 'pin', hash],
    })
    expect(consoleMessages).toHaveLength(3)
    const successMessage = consoleMessages[2]
    expect(successMessage).toBe('Pinned successfully')
  })

  it('should pin a collection with explicit index document', async () => {
    const hash = await uploadAndGetHash('test/command', 'pinning.spec.ts')
    expect(hash).toMatch(/[a-z0-9]{64}/)
    await cli({
      rootCommandClasses,
      optionParameters,
      testArguments: ['pinning', 'pin', hash],
    })
    expect(consoleMessages).toHaveLength(3)
    const successMessage = consoleMessages[2]
    expect(successMessage).toBe('Pinned successfully')
  })

  it('should list less pinned items after unpinning', async () => {
    const hash = await uploadAndGetHash('test/command')
    consoleMessages = []
    await cli({
      rootCommandClasses,
      optionParameters,
      testArguments: ['pinning', 'list'],
    })
    const containsHash = consoleMessages.some(message => message.includes(hash))
    expect(containsHash).toBe(true)
    const countOfItemsBefore = consoleMessages.length
    expect(countOfItemsBefore).toBeGreaterThanOrEqual(1)
    consoleMessages = []
    await cli({
      rootCommandClasses,
      optionParameters,
      testArguments: ['pinning', 'unpin', hash],
    })
    expect(consoleMessages.length).toBe(1)
    expect(consoleMessages[0]).toContain('Unpinned successfully')
    consoleMessages = []
    await cli({
      rootCommandClasses,
      optionParameters,
      testArguments: ['pinning', 'list'],
    })
    const containsHashAfterUnpin = consoleMessages.some(message => message.includes(hash))
    expect(containsHashAfterUnpin).toBe(false)
    const countOfItemsAfter = consoleMessages.length
    expect(countOfItemsAfter).toBeLessThan(countOfItemsBefore)
  })

  it('should print custom 404 when pinning chunk that does not exist', async () => {
    await cli({
      rootCommandClasses,
      optionParameters,
      testArguments: ['pinning', 'pin', 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'],
    })
    expect(consoleMessages).toHaveLength(2)
    expect(consoleMessages[0]).toContain(
      'Could not pin ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    )
    expect(consoleMessages[1]).toContain('No root chunk found with that address.')
  })

  it('should print custom 404 when unpinning chunk that does not exist', async () => {
    await cli({
      rootCommandClasses,
      optionParameters,
      testArguments: ['pinning', 'unpin', 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'],
    })
    expect(consoleMessages).toHaveLength(2)
    expect(consoleMessages[0]).toContain(
      'Could not unpin ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    )
    expect(consoleMessages[1]).toContain('No pinned chunk found with that address.')
  })
})

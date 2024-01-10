import { satisfy } from '__federation_fn_satisfy'
// eslint-disable-next-line no-undef
const moduleMap = __rf_var__moduleMap // TODO разобраться что происходит
const moduleCache = Object.create(null)

/**
 * @typedef {Object} sharedOptions - https://github.com/originjs/vite-plugin-federation?tab=readme-ov-file#shared
 * @property {boolean} [import=true] TODO: not implemented
 * @property {string} [shareScope='default']
 * @property {string} [version]
 * @property {string} [requiredVersion]
 * @property {string} [packagePath] - only dev mode
 * @property {boolean} [generate=true]
 */

/**
 * @typedef {Object} sharedFunctionParams
 * @param name {string} - key of shared object inside federation config
 * @param [options] {sharedOptions} - object with shared options from config
 */

/**
 * Function that resolve shared library
 * @param params {sharedFunctionParams}
 * @return {string|null} - version from package.json
 */
const getSharedModuleVersion = ({ name, options }) => {
  if (!globalThis?.__federation_shared__?.[options.shareScope]?.[name]) {
    return null
  }

  const versionObj = globalThis.__federation_shared__[options.shareScope][name]
  const versionKey = Object.keys(versionObj)[0]

  return versionKey || null
}

/**
 * Function that resolve shared library
 * @param params {sharedFunctionParams}
 * @return {any|null} - module js or null
 */
const getSharedModuleValue = ({ name, options }) => {
  if (!globalThis?.__federation_shared__?.[options.shareScope]?.[name]) {
    return null
  }

  const versionObj = globalThis.__federation_shared__[options.shareScope][name]
  const versionValue = Object.values(versionObj)[0]

  return versionValue || null
}

/**
 * Function that resolve shared library
 * @param params {sharedFunctionParams}
 * @return {Promise<any>} - Promise resolved JS module
 */
async function importShared({ name, options }) {
  const { shareScope, requiredVersion } = options || {}

  if (!moduleCache[shareScope]) {
    moduleCache[shareScope] = Object.create(null)
  }

  if (!moduleCache[shareScope][name]) {
    moduleCache[shareScope][name] = Object.create(null)
  }

  if (!requiredVersion) {
    moduleCache[shareScope][name]['first-loaded'] = await getSharedFromRuntime({
      name,
      options
    })
    moduleCache[shareScope][name][getSharedModuleVersion({ name, options })] =
      moduleCache[shareScope][name]['first-loaded']
    return moduleCache[shareScope][name]['default']
  }

  const sharedVersion = getSharedModuleVersion({ name, options })
  const sharedValue = getSharedModuleValue({ name, options })

  if (sharedVersion && requiredVersion && sharedValue) {
    const isSatisfied = satisfy(sharedVersion, requiredVersion)
    // тут тоже как будто можно упростить
    if (isSatisfied) {
      const module = await (await sharedValue.get())()
      return flattenModule(module, name)
    } else {
      return getSharedFromLocal(name)
    }
  }

  // TODO упростить и дописать часть логики, которая будет резолвить модуль запрашиваемый ремоутом первый раз
}
// eslint-disable-next-line
async function __federation_import(name) {
  return import(name)
}

/**
 * Resolve shared module in runtime from globalThis.__federation_shared__
 * @param params {sharedFunctionParams}
 * @return {Promise<any | void>} - Promise resolved JS module
 */
async function getSharedFromRuntime({ name, options }) {
  const sharedValue = getSharedModuleValue({ name, options })
  if (!sharedValue) return

  return flattenModule(sharedValue.get(), name)
}

async function getSharedFromLocal(name) {
  if (moduleMap[name]?.import) {
    let module = await (await moduleMap[name].get())()
    return flattenModule(module, name)
  } else {
    console.error(
      `consumer config import=false,so cant use callback shared module`
    )
  }
}
function flattenModule(module) {
  // use a shared module which export default a function will getting error 'TypeError: xxx is not a function'
  if (typeof module.default === 'function') {
    Object.keys(module).forEach((key) => {
      if (key !== 'default') {
        module.default[key] = module[key]
      }
    })
    // moduleCache[name] = module.default TODO сохранение в кэш отдельно
    return module.default
  }
  if (module.default) module = Object.assign({}, module.default, module)
  // moduleCache[name] = module.default TODO сохранение в кэш отдельно
  return module
}
export { importShared }

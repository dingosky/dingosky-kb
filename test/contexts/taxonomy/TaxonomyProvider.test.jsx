import { useContext, useEffect } from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { ErrorBoundary } from 'react-error-boundary'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ConfigContext from '@/contexts/config/ConfigContext'
import TaxonomyProvider from '@/contexts/taxonomy/TaxonomyProvider'
import TaxonomyContext from '@/contexts/taxonomy/TaxonomyContext'
import UserContext from '@/contexts/user/UserContext'

import {
  getConcept as apiConcept,
  getConceptChildren as apiChildren,
  getConceptNames as apiConceptNames,
} from '@/lib/api/concept'
import { getMedia } from '@/lib/api/media'
import { getConceptLinkRealizations } from '@/lib/api/realizations'
import { getNames as apiNames, getRanks as apiRanks, getRoot as apiRoot } from '@/lib/api/taxonomy'

const cloneItems = items => items.map(item => ({ ...item }))

const cloneConcept = concept => {
  const cloned = {
    ...concept,
    alternateNames: [...concept.alternateNames],
    media: cloneItems(concept.media || []),
    realizations: cloneItems(concept.realizations || []),
    references: [...(concept.references || [])],
    templates: [...(concept.templates || [])],
  }

  if (concept.children !== undefined) {
    cloned.children = [...concept.children]
  }

  if (concept.aliases) {
    cloned.aliases = cloneItems(concept.aliases)
  }

  return cloned
}

const createConceptRecord = ({ alternateNames = [], children, name, parent }) => {
  const concept = {
    alternateNames,
    media: [],
    name,
    parent,
    realizations: [],
    references: [],
    templates: [],
  }

  if (children !== undefined) {
    concept.children = children
  }

  return concept
}

const createStore = () => ({
  children: {
    root: ['new-parent', 'old-parent'],
    'new-parent': [],
    'old-parent': ['moving-child'],
    'moving-child': [],
  },
  concepts: {
    root: createConceptRecord({ name: 'root', parent: undefined }),
    'new-parent': createConceptRecord({
      alternateNames: ['new-parent-alias'],
      name: 'new-parent',
      parent: 'root',
    }),
    'old-parent': createConceptRecord({
      alternateNames: ['old-parent-alias'],
      name: 'old-parent',
      parent: 'root',
    }),
    'moving-child': createConceptRecord({
      alternateNames: ['moving-child-alias'],
      name: 'moving-child',
      parent: 'old-parent',
    }),
  },
  ranks: [],
})

const createAliases = (store, conceptName) =>
  (store.concepts[conceptName]?.alternateNames || []).map(name => ({
    author: '',
    name,
    nameType: 'Common',
  }))

const sortNames = store =>
  Object.values(store.concepts)
    .flatMap(concept => [concept.name, ...concept.alternateNames])
    .sort((a, b) => a.localeCompare(b))

const createApiFns = store => ({
  apiPayload: vi.fn(async (fn, value) => {
    if (fn === apiRoot) {
      return { name: 'root' }
    } else if (fn === apiNames) {
      return sortNames(store)
    } else if (fn === apiRanks) {
      return [...store.ranks]
    } else if (fn === apiConcept) {
      return cloneConcept(store.concepts[value])
    } else if (fn === apiChildren) {
      return (store.children[value] || []).map(childName => cloneConcept(store.concepts[childName]))
    } else if (fn === apiConceptNames) {
      return createAliases(store, value)
    } else if (fn === getMedia) {
      return cloneItems(store.concepts[value]?.media || [])
    } else if (fn === getConceptLinkRealizations) {
      return cloneItems(store.concepts[value]?.realizations || [])
    }

    throw new Error(`Unexpected api payload function: ${fn?.name || 'unknown'}`)
  }),
})

const TaxonomyProbe = ({ onChange }) => {
  const value = useContext(TaxonomyContext)

  useEffect(() => {
    onChange(value)
  }, [onChange, value])

  return null
}

const renderTaxonomy = async () => {
  const store = createStore()
  const apiFns = createApiFns(store)
  const errors = []
  let latestContext

  render(
    <ErrorBoundary fallbackRender={() => null} onError={error => errors.push(error)}>
      <UserContext.Provider value={{ user: { role: 'Admin' } }}>
        <ConfigContext.Provider value={{ apiFns }}>
          <TaxonomyProvider>
            <TaxonomyProbe onChange={value => { latestContext = value }} />
          </TaxonomyProvider>
        </ConfigContext.Provider>
      </UserContext.Provider>
    </ErrorBoundary>
  )

  await waitFor(() => {
    expect(latestContext).toBeDefined()
    expect(latestContext.taxonomy).not.toBeNull()
  })

  return {
    apiFns,
    errors,
    getContext: () => latestContext,
    store,
  }
}

const apiCallsFor = (apiPayload, fn) => apiPayload.mock.calls.filter(([calledFn]) => calledFn === fn)

describe('TaxonomyProvider conceptEditsRefresh', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the current taxonomy without extra API work when fresh and stale concepts are identical', async () => {
    const { apiFns, errors, getContext } = await renderTaxonomy()
    const staleConcept = getContext().getConcept('moving-child')
    const priorTaxonomy = getContext().taxonomy

    apiFns.apiPayload.mockClear()

    let refreshResult
    await act(async () => {
      refreshResult = await getContext().conceptEditsRefresh(staleConcept, staleConcept)
    })

    expect(refreshResult.concept).toBe(staleConcept)
    expect(refreshResult.taxonomy).toBe(priorTaxonomy)
    expect(getContext().taxonomy).toBe(priorTaxonomy)
    expect(apiFns.apiPayload).not.toHaveBeenCalled()
    expect(errors).toEqual([])
  })

  it('updates only the edited concept for non-structural changes and preserves unrelated references', async () => {
    const { errors, getContext } = await renderTaxonomy()
    const staleConcept = getContext().getConcept('moving-child')
    const oldParent = getContext().getConcept('old-parent')
    const newParent = getContext().getConcept('new-parent')
    const priorNames = getContext().taxonomy.names

    const freshConcept = {
      ...cloneConcept(staleConcept),
      media: [{ isPrimary: true, mediaType: 'IMAGE', url: 'https://example.test/moving-child.jpg' }],
    }

    await act(async () => {
      await getContext().conceptEditsRefresh(freshConcept, staleConcept)
    })

    expect(getContext().taxonomy.conceptMap['moving-child']).toBe(freshConcept)
    expect(getContext().taxonomy.conceptMap['old-parent']).toBe(oldParent)
    expect(getContext().taxonomy.conceptMap['new-parent']).toBe(newParent)
    expect(getContext().taxonomy.names).toBe(priorNames)
    expect(errors).toEqual([])
  })

  it('reuses an already-updated child object when a stale parent refresh arrives later', async () => {
    const { apiFns, errors, getContext, store } = await renderTaxonomy()
    const staleChild = getContext().getConcept('moving-child')
    const staleNewParent = getContext().getConcept('new-parent')

    const freshChild = {
      ...cloneConcept(staleChild),
      parent: 'new-parent',
    }

    await act(async () => {
      await getContext().conceptEditsRefresh(freshChild, staleChild)
    })

    store.concepts['moving-child'].parent = 'new-parent'
    store.children['old-parent'] = []
    store.children['new-parent'] = ['moving-child']

    const movedChild = getContext().getConcept('moving-child')

    apiFns.apiPayload.mockClear()

    const staleParentSnapshot = cloneConcept(staleNewParent)
    const freshParent = {
      ...cloneConcept(staleNewParent),
      children: ['moving-child'],
    }

    await act(async () => {
      await getContext().conceptEditsRefresh(freshParent, staleParentSnapshot)
    })

    expect(getContext().getConcept('moving-child')).toBe(movedChild)
    expect(getContext().getConcept('new-parent').children).toEqual(['moving-child'])
    expect(apiCallsFor(apiFns.apiPayload, apiConcept)).toHaveLength(0)
    expect(errors).toEqual([])
  })

  it('keeps taxonomy integrity when a concept is renamed and reparented together', async () => {
    const { errors, getContext, store } = await renderTaxonomy()
    const staleConcept = getContext().getConcept('moving-child')

    const freshConcept = {
      ...cloneConcept(staleConcept),
      name: 'renamed-child',
      parent: 'new-parent',
    }

    store.concepts['renamed-child'] = {
      ...cloneConcept(store.concepts['moving-child']),
      name: 'renamed-child',
      parent: 'new-parent',
    }
    delete store.concepts['moving-child']
    store.children['old-parent'] = []
    store.children['new-parent'] = ['renamed-child']

    await act(async () => {
      await getContext().conceptEditsRefresh(freshConcept, staleConcept)
    })

    expect(getContext().getConcept('renamed-child')).toBe(freshConcept)
    expect(getContext().taxonomy.conceptMap['moving-child']).toBeUndefined()
    expect(getContext().getConcept('old-parent').children).toEqual([])
    expect(getContext().getConcept('new-parent').children).toEqual(['renamed-child'])
    expect(getContext().taxonomy.aliasMap['moving-child-alias']).toBe(freshConcept)
    expect(getContext().taxonomy.names).toContain('renamed-child')
    expect(getContext().taxonomy.names).not.toContain('moving-child')
    expect(errors).toEqual([])
  })

  it('returns the committed concept and taxonomy when integrity rejects a speculative refresh', async () => {
    const { errors, getContext } = await renderTaxonomy()
    const priorTaxonomy = getContext().taxonomy
    const staleConcept = getContext().getConcept('old-parent')
    const invalidFreshConcept = {
      ...cloneConcept(staleConcept),
      children: ['moving-child', 'moving-child'],
    }

    let refreshResult
    await act(async () => {
      refreshResult = await getContext().conceptEditsRefresh(invalidFreshConcept, staleConcept)
    })

    expect(refreshResult.taxonomy).toBe(priorTaxonomy)
    expect(refreshResult.concept).toBe(staleConcept)
    expect(getContext().taxonomy).toBe(priorTaxonomy)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toMatch(/duplicate child reference "moving-child"/)
  })
})

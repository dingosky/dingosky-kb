import conceptStateReducer from '@/contexts/panels/concepts/staged/edit/conceptStateReducer'
import { stateUpdates } from '@/contexts/panels/concepts/staged/edit/stateUpdates'
import { isStateModified } from '@/lib/concept/state/state'
import * as media from '@/lib/concept/state/media'
import { CONCEPT_STATE } from '@/lib/constants/conceptState'
import { describe, expect, it } from 'vitest'

const { MEDIA_ITEM } = CONCEPT_STATE

const baseStagedState = {
  aliasIndex: 0,
  aliases: [],
  author: { action: 'None', value: '' },
  children: [],
  deleteConcept: false,
  media: [],
  mediaIndex: 0,
  name: { action: 'None', value: '', extent: '' },
  parent: { action: 'None', value: '' },
  rank: { action: 'None', level: '', name: '' },
  realizations: [],
  realizationIndex: 0,
  templates: [],
}

const initialState = { ...baseStagedState }

describe('conceptStateReducer media', () => {
  it('adds a media item and verifies isModified', () => {
    const mediaItem = {
      url: 'https://example.com/image.jpg',
      mediaType: 'Image',
      isPrimary: false,
    }

    const stagedState = conceptStateReducer(baseStagedState, {
      type: MEDIA_ITEM.ADD,
      update: { mediaItem },
      initialState,
    })

    expect(stagedState.media).toHaveLength(1)
    expect(stagedState.media[0]).toMatchObject({
      url: 'https://example.com/image.jpg',
      mediaType: 'Image',
      isPrimary: false,
      action: MEDIA_ITEM.ADD,
    })

    expect(media.isModified(initialState, stagedState)).toBe(true)
    expect(isStateModified({ initialState, stagedState })).toBe(true)
  })

  it('verifies stateUpdates from media matches reducer output', () => {
    const mediaItem = {
      url: 'https://example.com/staged.jpg',
      mediaType: 'Image',
      isPrimary: false,
    }

    const stagedState = conceptStateReducer(baseStagedState, {
      type: MEDIA_ITEM.ADD,
      update: { mediaItem },
      initialState,
    })

    const mediaStateUpdates = media.stateUpdates(initialState, stagedState)
    expect(mediaStateUpdates.media).toBeDefined()
    expect(mediaStateUpdates.media.initial).toEqual([])
    expect(mediaStateUpdates.media.staged).toHaveLength(1)
    expect(mediaStateUpdates.media.staged[0]).toMatchObject({
      url: 'https://example.com/staged.jpg',
      mediaType: 'Image',
      isPrimary: false,
      action: MEDIA_ITEM.ADD,
    })

    const fullStateUpdates = stateUpdates(initialState, stagedState)
    expect(fullStateUpdates.media).toBeDefined()
    expect(fullStateUpdates.media.initial).toEqual([])
    expect(fullStateUpdates.media.staged).toEqual(stagedState.media)
  })

  it('edits the added media item and verifies new staged values', () => {
    const mediaItem = {
      url: 'https://example.com/original.jpg',
      mediaType: 'Image',
      isPrimary: false,
    }

    let stagedState = conceptStateReducer(baseStagedState, {
      type: MEDIA_ITEM.ADD,
      update: { mediaItem },
      initialState,
    })

    stagedState = conceptStateReducer(stagedState, {
      type: MEDIA_ITEM.EDIT,
      update: {
        mediaIndex: 0,
        mediaItem: { url: 'https://example.com/edited.jpg' },
      },
      initialState,
    })

    expect(stagedState.media).toHaveLength(1)
    expect(stagedState.media[0].url).toBe('https://example.com/edited.jpg')

    const mediaStateUpdates = media.stateUpdates(initialState, stagedState)
    expect(mediaStateUpdates.media.staged[0].url).toBe('https://example.com/edited.jpg')
  })

  it('deletes the added media item and verifies isModified is false', () => {
    const mediaItem = {
      url: 'https://example.com/to-delete.jpg',
      mediaType: 'Image',
      isPrimary: false,
    }

    let stagedState = conceptStateReducer(baseStagedState, {
      type: MEDIA_ITEM.ADD,
      update: { mediaItem },
      initialState,
    })

    expect(stagedState.media).toHaveLength(1)
    expect(media.isModified(initialState, stagedState)).toBe(true)

    stagedState = conceptStateReducer(stagedState, {
      type: MEDIA_ITEM.DELETE,
      update: { mediaIndex: 0 },
      initialState,
    })

    expect(stagedState.media).toHaveLength(0)
    expect(media.isModified(initialState, stagedState)).toBe(false)
    expect(isStateModified({ initialState, stagedState })).toBe(false)

    const mediaStateUpdates = media.stateUpdates(initialState, stagedState)
    expect(mediaStateUpdates).toEqual({})
  })

  it('full flow: add, verify stateUpdates, edit, verify, delete, verify isModified false', () => {
    const mediaItem = {
      url: 'https://example.com/dingo.jpg',
      mediaType: 'Image',
      isPrimary: false,
    }

    let stagedState = conceptStateReducer(baseStagedState, {
      type: MEDIA_ITEM.ADD,
      update: { mediaItem },
      initialState,
    })

    expect(stagedState.media).toHaveLength(1)
    expect(stagedState.media[0].url).toBe('https://example.com/dingo.jpg')
    expect(isStateModified({ initialState, stagedState })).toBe(true)

    let updates = media.stateUpdates(initialState, stagedState)
    expect(updates.media.initial).toEqual([])
    expect(updates.media.staged[0]).toMatchObject({
      url: 'https://example.com/dingo.jpg',
      mediaType: 'Image',
      action: MEDIA_ITEM.ADD,
    })

    stagedState = conceptStateReducer(stagedState, {
      type: MEDIA_ITEM.EDIT,
      update: {
        mediaIndex: 0,
        mediaItem: { url: 'https://example.com/dingo-updated.jpg' },
      },
      initialState,
    })

    expect(stagedState.media[0].url).toBe('https://example.com/dingo-updated.jpg')

    updates = media.stateUpdates(initialState, stagedState)
    expect(updates.media.staged[0].url).toBe('https://example.com/dingo-updated.jpg')

    stagedState = conceptStateReducer(stagedState, {
      type: MEDIA_ITEM.DELETE,
      update: { mediaIndex: 0 },
      initialState,
    })

    expect(stagedState.media).toHaveLength(0)
    expect(isStateModified({ initialState, stagedState })).toBe(false)
    expect(media.stateUpdates(initialState, stagedState)).toEqual({})
  })
})

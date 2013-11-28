(function(window, $) {

  "use loose"

  var document = window.document

  var saveSelection = function() {
    var i = 0
    var sel = window.getSelection()
    var len = sel.rangeCount
    var ranges
    if (sel.getRangeAt && sel.rangeCount) {
      ranges = []
      for (; i < len; i++)
        ranges.push(sel.getRangeAt(i))
  
      return ranges
    }
    return null
  }

  var restoreSelection = function(savedSel) {
    if ( !savedSel )
      return
    var i = 0
    var len = savedSel.length
    var sel = window.getSelection()
    sel.removeAllRanges()
    for (; i < len; i++)
      sel.addRange(savedSel[i])

  }

  var getSelectionStart = function() {
    var node = document.getSelection().anchorNode
    return node && node.nodeType === 3 ? node.parentNode : node
  }

  var getSelectionHtml = function() {
    var html = ''
    var i, sel, len, container
    if (typeof window.getSelection != 'undefined') {
      sel = window.getSelection()
      len = sel.rangeCount
      if (sel.rangeCount) {
        container = document.createElement('div')
        for (; i < len; i += 1)
          container.appendChild(sel.getRangeAt(i).cloneContents())

        html = container.innerHTML
      }
    } else if (document.selection !== undefined) {
      if (document.selection.type === 'Text') {
        html = document.selection.createRange().htmlText
      }
    }
    return html
  }

  var Medium = function(element, options) {
    
    if (!(this instanceof Medium)) {
      return new Medium(element, options)
    }

    this.options = $.extend(options, {
      anchorInputPlaceholder: 'Paste or type a link',
      delay: 0,
      diffLeft: 0,
      diffTop: -10,
      disableReturn: false,
      disableToolbar: false,
      firstHeader: 'h3',
      forcePlainText: true,
      allowMultiParagraphSelection: true,
      placeholder: 'Type your text',
      secondHeader: 'h4',
      buttons: ['bold', 'italic', 'anchor', 'header1', 'header2', 'quote', 'unorderedlist']
    })

    this.element = element
    this.$element = $(element)

    this.isActive = true
    this.parentElements = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote']
    this.id = Math.floor(Math.random()*123456789)

    return this.initElements().bindSelect().bindPaste().setPlaceholders().bindWindowActions()
  }

  Medium.prototype = {

    constructor: Medium,
    
    initElements: function () {
      
      this.$element.prop('contentEditable', true)
      
      if (!this.$element.attr('data-placeholder'))
        this.$element.attr('data-placeholder', this.options.placeholder)

      this.$element.attr('data-medium-element', true)
      this.bindParagraphCreation().bindReturn()

      if (!this.options.disableToolbar)
         this.initToolbar().bindButtons().bindAnchorForm()

      return this
    },

    bindParagraphCreation: function () {
      var self = this
      this.$element.on('keyup', function (e) {

        var $node = $( getSelectionStart() )
        var tagName
        
        if ($node.length && $node.attr('data-medium-element') && !$node.children().length && !self.options.disableReturn) {
          document.execCommand('formatBlock', false, 'p')
        }
        if (e.which === 13 && !e.shiftKey) {
          $node = $( getSelectionStart() )
          if (!(self.options.disableReturn) && !$node.is('li')) {
            document.execCommand('formatBlock', false, 'p')
            if ($node.is('a'))
              document.execCommand('unlink', false, null)
            
          }
        }
      })
      return this
    },

    bindReturn: function () {
      var self = this
      this.$element.on('keypress', function (e) {
        if (e.which === 13 && !e.shiftKey && self.options.disableReturn)
          e.preventDefault()
      })
      return this
    },

    buttonFactory: function(type) {

      // HTML, data-element, data-action

      var map = {
        bold:          ['B', 'b', 'bold'],
        italic:        ['I', 'i', 'italic'],
        underline:     ['U', 'u', 'underline'],
        superscript:   ['<sup>1</sup>', 'sup', 'superscript'],
        subscript:     ['<sub>1</sub>', 'sub', 'subscript'],
        anchor:        ['<i class="fa fa-link"></i>', 'a', 'anchor'],
        header1:       ['h1', this.options.firstHeader, 'append-'+this.options.firstHeader],
        header2:       ['h2', this.options.secondHeader, 'append-'+this.options.secondHeader],
        quote:         ['<i class="fa fa-quote-right"></i>', 'blockquote', 'append-blockquote'],
        orderedlist:   ['1.', 'ol', 'insertorderedlist'],
        unorderedlist: ['<i class="fa fa-list"></i>', 'ul', 'insertunorderedlist']
      }

      return map.hasOwnProperty(type) ?
        '<li><button class="medium-editor-action medium-editor-action-'+type+'" data-action="'+map[type][2]+
        '" data-element="'+map[type][1]+'">'+map[type][0]+'</button></li>' : ''
    },

    //TODO: actionTemplate

    toolbarTemplate: function () {
      var btns = this.options.buttons
      var html = '<ul id="medium-editor-toolbar-actions" class="medium-editor-toolbar-actions clearfix">'
      var i = 0

      for (var i=0; i < btns.length; i++) {
        html += this.buttonFactory(btns[i])
      }

      html += '</ul>' +
        '<div class="medium-editor-toolbar-form-anchor" id="medium-editor-toolbar-form-anchor">' +
        '    <input type="text" value="" placeholder="' + this.options.anchorInputPlaceholder + '">' +
        '    <a href="#">&times;</a>' +
        '</div>'
      return html
    },

    initToolbar: function () {
      if (this.$toolbar)
        return this
      this.$toolbar = this.createToolbar()
      this.keepToolbarAlive = false
      this.$anchorForm = this.$toolbar.find('.medium-editor-toolbar-form-anchor')
      this.$anchorInput = this.$anchorForm.find('input')
      this.$toolbarActions = this.$toolbar.find('.medium-editor-toolbar-actions')
      return this
    },
    
    createToolbar: function () {
      return $('<div>').prop('id', 'medium-editor-toolbar-' + this.id)
        .addClass('medium-editor-toolbar').html( this.toolbarTemplate() ).appendTo( 'body' )
    },

    bindSelect: function () {
      var self = this
      var timer
      this.checkSelectionWrapper = function (e) {
        clearTimeout(timer)
        timer = setTimeout(function () {
          self.checkSelection(e)
        }, self.options.delay)
      }
      $('html').on('mouseup', this.checkSelectionWrapper)

      this.$element.on('keyup blur', this.checkSelectionWrapper)
      return this
    },

    checkSelection: function () {
      var newSelection
      var hasMultiParagraphs
      var selectionHtml
      var selectionElement
      
      if (this.keepToolbarAlive !== true && !this.options.disableToolbar) {

        newSelection = window.getSelection()
        selectionHtml = getSelectionHtml()
        selectionHtml = selectionHtml.replace(/<[\S]+><\/[\S]+>/gim, '')

        // Check if selection is between multi paragraph <p>
        hasMultiParagraphs = selectionHtml.match(/<(p|h[0-6]|blockquote)>([\s\S]*?)<\/(p|h[0-6]|blockquote)>/g)
        hasMultiParagraphs = hasMultiParagraphs ? hasMultiParagraphs.length : 0
        if (!$.trim(newSelection.toString()) || (this.options.allowMultiParagraphSelection === false && hasMultiParagraphs)) {
            this.hideToolbarActions()
        } else {
          selectionElement = this.getSelectionElement()
          if (!selectionElement || selectionElement.getAttribute('data-disable-toolbar')) {
            this.hideToolbarActions()
          } else {
            this.selection = newSelection
            this.selectionRange = this.selection.getRangeAt(0)
            if (this.element === selectionElement) {
              this.setToolbarButtonStates().setToolbarPosition().showToolbarActions()
              return
            }
            this.hideToolbarActions()
          }
        }
      }
      return this
    },
    
    getSelectionElement: function () {
      var selection = window.getSelection()
      var range = selection.getRangeAt(0)
      var current = range.commonAncestorContainer
      var parent = current.parentNode
      var result
      var getMediumElement = function(e) {
        var parent = e
        try {
          while (!parent.getAttribute('data-medium-element'))
            parent = parent.parentNode
        } catch (errb) {
            return false
        }
        return parent
      }

      // First try on current node
      try {
        if (current.getAttribute('data-medium-element')) {
          result = current
        } else {
          result = getMediumElement(parent)
        }
        // If not search in the parent nodes.
      } catch (err) {
          result = getMediumElement(parent)
      }
      return result
    },

  setToolbarPosition: function () {
    var buttonHeight = 50
    var selection = window.getSelection()
    var range = selection.getRangeAt(0)
    var boundary = range.getBoundingClientRect()
    var defaultLeft = (this.options.diffLeft) - (this.$toolbar.width() / 2)
    var middleBoundary = (boundary.left + boundary.right) / 2
    var halfOffsetWidth = this.$toolbar.width() / 2

    if (boundary.top < buttonHeight) {
      this.$toolbar.addClass('medium-toolbar-arrow-over')
      this.$toolbar.removeClass('medium-toolbar-arrow-under')
      this.$toolbar.css('top', buttonHeight + boundary.bottom - this.options.diffTop + window.pageYOffset - this.$toolbar.height())
    } else {
      this.$toolbar.addClass('medium-toolbar-arrow-under')
      this.$toolbar.removeClass('medium-toolbar-arrow-over')
      this.$toolbar.css('top', boundary.top + this.options.diffTop + window.pageYOffset - this.$toolbar.height())
    }
    if (middleBoundary < halfOffsetWidth) {
      this.$toolbar.css('left', defaultLeft + halfOffsetWidth)
    } else if ((window.innerWidth - middleBoundary) < halfOffsetWidth) {
      this.$toolbar.css('left', $(window).width() + defaultLeft - halfOffsetWidth)
    } else {
      this.$toolbar.css('left', defaultLeft + middleBoundary)
    }
    return this
  },

  setToolbarButtonStates: function () {
    this.$toolbarActions.find('button').removeClass('medium-editor-button-active')
    this.checkActiveButtons()
    return this
  },

  checkActiveButtons: function () {
    var parentNode = this.selection.anchorNode
    if (!parentNode.tagName)
      parentNode = this.selection.anchorNode.parentNode

    while (parentNode.tagName !== undefined && this.parentElements.indexOf(parentNode.tagName) === -1) {
      this.activateButton(parentNode.tagName.toLowerCase())
      parentNode = parentNode.parentNode
    }
  },

  activateButton: function (tag) {
    this.$toolbar.find('[data-element="' + tag + '"]').addClass('medium-editor-button-active')
  },

  bindButtons: function () {
    var self = this
    var $buttons = this.$toolbar.find('button').on('click', function(e) {
      e.preventDefault()
      e.stopPropagation()
      if (typeof self.selection == 'undefined') {
        self.checkSelection(e)
      }
      $(this).toggleClass('medium-editor-button-active')
      self.execAction($(this).attr('data-action'), e)
    })

    $buttons.first().addClass('medium-editor-button-first')
    $buttons.last().addClass('medium-editor-button-last')
    return this
  },

  execAction: function (action, e) {
    if (action.indexOf('append-') > -1) {
      this.execFormatBlock(action.replace('append-', ''))
      this.setToolbarPosition()
      this.setToolbarButtonStates()
    } else if (action === 'anchor') {
      this.triggerAnchorAction(e)
    } else {
      document.execCommand(action, false, null)
      this.setToolbarPosition()
    }
  },

  triggerAnchorAction: function () {
    if (this.selection.anchorNode.parentNode.tagName.toLowerCase() === 'a') {
      document.execCommand('unlink', false, null)
    } else {
      if (this.$anchorForm.is(':visible')) {
        this.showToolbarActions()
      } else {
        this.showAnchorForm()
      }
    }
    return this
  },

  execFormatBlock: function (el) {

    var selectionData = this.getSelectionData(this.selection.anchorNode)

    // FF handles blockquote differently on formatBlock
    // allowing nesting, we need to use outdent
    // https://developer.mozilla.org/en-US/docs/Rich-Text_Editing_in_Mozilla
    if (el === 'blockquote' && selectionData.el && selectionData.el.parentNode.tagName.toLowerCase() === 'blockquote')
      return document.execCommand('outdent', false, null)

    if (selectionData.tagName === el)
      el = 'p'

    return document.execCommand('formatBlock', false, el)
  },

  getSelectionData: function (el) {
    var tagName

    if (el && el.tagName)
      tagName = el.tagName.toLowerCase()

    while (el && this.parentElements.indexOf(tagName) === -1) {
      el = el.parentNode
      if (el && el.tagName)
        tagName = el.tagName.toLowerCase()
    }

    return {
      el: el,
      tagName: tagName
    }
  },

  hideToolbarActions: function () {
    this.keepToolbarAlive = false
    this.$toolbar.removeClass('medium-editor-toolbar-active')
  },

  showToolbarActions: function () {
    var self = this
    var timer
    this.$anchorForm.hide()
    this.$toolbarActions.show()
    this.keepToolbarAlive = false
    clearTimeout(timer)
    timer = setTimeout(function() {
      self.$toolbar.addClass('medium-editor-toolbar-active')
    }, 100)
  },

  showAnchorForm: function () {
    this.savedSelection = saveSelection()
    this.$anchorForm.show()
    this.keepToolbarAlive = true
    this.$anchorInput.focus().val('')
  },

  bindAnchorForm: function () {
    var $linkCancel = this.$anchorForm.find('a')
    var self = this
    this.$anchorForm.on('click', function (e) {
      e.stopPropagation()
    })
    this.$anchorInput.on('keyup', function (e) {
      if (e.which === 13) {
        e.preventDefault()
        self.createLink(this)
      }
    })
    this.$anchorInput.on('blur', function (e) {
      self.keepToolbarAlive = false
      self.checkSelection()
    })
    $linkCancel.on('click', function (e) {
      e.preventDefault()
      self.showToolbarActions()
      restoreSelection(self.savedSelection)
    })
    return this
  },

  createLink: function (input) {
    restoreSelection(this.savedSelection)
    document.execCommand('createLink', false, input.value)
    this.showToolbarActions()
    input.value = ''
  },

  bindWindowActions: function () {
    var timerResize
    var self = this
    $(window).on('resize', function () {
      clearTimeout(timerResize)
      timerResize = setTimeout(function () {
        if (self.$toolbar.hasClass('medium-editor-toolbar-active')) {
          self.setToolbarPosition()
        }
      }, 100)
    })
    return this
  },

  activate: function () {
    if (this.isActive)
      return

    if(this.$toolbar)
      this.$toolbar.show()

    this.isActive = true
    this.$element.prop('contentEditable', true)
    this.bindSelect()
  },

  deactivate: function () {
    if (!this.isActive)
      return

    this.isActive = false
    if (this.$toolbar)
      this.$toolbar.hide()

    $('html').off('mouseup', this.checkSelectionWrapper)
    this.$element.off('keyup blur', this.checkSelectionWrapper).removeProp('contentEditable')
  },

  bindPaste: function () {
    if (!this.options.forcePlainText)
      return

    var self = this
    var pasteWrapper = function (e) {
      var paragraphs
      var html = ''
      var p = 0
      $(this).removeClass('medium-editor-placeholder')
      if (e.clipboardData && e.clipboardData.getData) {
        e.preventDefault()
        if (!self.options.disableReturn) {
          paragraphs = e.clipboardData.getData('text/plain').split(/[\r\n]/g)
          for (; p < paragraphs.length; p++) {
            if (paragraphs[p] !== "")
              html += '<p>' + paragraphs[p] + '</p>'
  
          }
          document.execCommand('insertHTML', false, html)
        } else {
          document.execCommand('insertHTML', false, e.clipboardData.getData('text/plain'))
        }
      }
    }
    this.$element.on('paste', pasteWrapper)
    return this
  },

  setPlaceholders: function () {
    var $element = this.$element
    var activatePlaceholder = function() {
      $element.toggleClass('medium-editor-placeholder', !$.trim($element.text()))
    }
    var placeholderWrapper = function (e) {
      $(this).removeClass('medium-editor-placeholder')
      if (e.type !== 'keypress')
        activatePlaceholder()
    }
    activatePlaceholder()
    this.$element.on('blur keypress', placeholderWrapper)
    return this
  }
}

if ( typeof module === "object" && module && typeof module.exports === "object" ) {
  module.exports = Medium
} else {
  window.Medium = Medium
  if ( typeof define === "function" && define.amd ) {
    define( "medium", ['jquery'], function() { return Medium } )
  }
}

}(this, jQuery))
/**
 * Mapper class.
 * @param {string} url - Image load url.
 * @param {string|Element} imgContainer - Image container ID or element itself.
 * @param {string|Element} drawContainer - GraphicsJS draw container or element.
 * @param {string|Element} zoomImgContainer - Image zoom container or element.
 * @param {string|Element} zoomDrawContainer - GraphicsJS zoom container or element.
 * @constructor
 */
Mapper = function(url, imgContainer, drawContainer, zoomImgContainer, zoomDrawContainer) {

  /**
   * @type {string}
   */
  this.imgUrl_ = url;

  /**
   * @type {Element}
   * @private
   */
  this.imgContainer_ = Mapper.isString(imgContainer) ? document.getElementById(imgContainer) : imgContainer;

  /**
   * @type {Element}
   * @private
   */
  this.drawContainer_ = Mapper.isString(drawContainer) ? document.getElementById(drawContainer) : drawContainer;

  /**
   * @type {Element}
   * @private
   */
  this.zoomImgContainer_ = Mapper.isString(zoomImgContainer) ? document.getElementById(zoomImgContainer) : zoomImgContainer;

  /**
   * @type {Element}
   * @private
   */
  this.zoomDrawContainer_ = Mapper.isString(zoomDrawContainer) ? document.getElementById(zoomDrawContainer) : zoomDrawContainer;

  /**
   * Calculated image width.
   * @type {number}
   */
  this.originalImageHeight = NaN;

  /**
   * Calculated image width.
   * @type {number}
   */
  this.originalImageWidth = NaN;

  /**
   * DOM image height.
   * @type {number}
   */
  this.domImageHeight = NaN;

  /**
   * DOM image width.
   * @type {number}
   */
  this.domImageWidth = NaN;

  /**
   * @type {*}
   */
  this.imgWrapper = $(this.imgContainer_);

  /**
   * @type {*}
   */
  this.drawWrapper = $(this.drawContainer_);

  /**
   * @type {*}
   */
  this.zoomImgWrapper = $(this.zoomImgContainer_);

  /**
   * @type {*}
   */
  this.zoomDrawWrapper = $(this.zoomDrawContainer_);

  /**
   *
   * @type {acgraph.vector.Stage}
   * @private
   */
  this.stage_ = null;

  /**
   *
   * @type {Array.<Object>}
   * @private
   */
  this.points_ = [];

  /**
   *
   * @type {Array.<acgraph.vector.Path>}
   * @private
   */
  this.pathPoints_ = [];

  /**
   *
   * @type {Array.<acgraph.vector.Path>}
   * @private
   */
  this.zoomPathPoints_ = [];

  /**
   *
   * @type {acgraph.vector.Layer}
   * @private
   */
  this.drawLayer_ = null;

  /**
   *
   * @type {acgraph.math.Rect}
   * @private
   */
  this.stageBounds_ = null;

  /**
   *
   * @type {acgraph.vector.Element}
   * @private
   */
  this.interactivityHandler_ = null;

  /**
   * Edit mode: adding points or scaling.
   * @type {boolean}
   * @private
   */
  this.addPoints_ = true;

  /**
   * Zooming mode. If dragging.
   * @type {boolean}
   * @private
   */
  this.zoomig_ = false;

};


/**
 * Returns true if the specified value is a string.
 * @param {*} val - Variable to test.
 * @return {boolean} - Whether variable is a string.
 */
Mapper.isString = function(val) {
  return typeof val == 'string';
};


/**
 * Map image load callback.
 * @param callback
 */
Mapper.prototype.load = function(callback) {
  var ths = this;
  var img = $('<img style="width: 100%"/>');
  ths.imgWrapper.append(img);
  //863 x 593
  img.one('load', function() {
    ths.originalImageHeight = this.naturalHeight;
    ths.originalImageWidth = this.naturalWidth;

    ths.domImageHeight = this.height;
    ths.domImageWidth = this.width;

    ths.imgWrapper.parent().css('height', this.height);
    ths.zoomImgWrapper.parent().css('height', this.height);

    ths.initGraphics_();
  });
  img.attr('src', ths.imgUrl_);

  callback(); //no need to use callback.call() here.
};


Mapper.prototype.addPoints = function(val) {
  this.addPoints_ = val;
};

Mapper.prototype.initGraphics_ = function() {
  this.stage_ = acgraph.create(this.drawContainer_);
  this.stageBounds_ = this.stage_.getBounds();
  this.drawLayer_ = this.stage_.layer();
  this.interactivityHandler_ = this.drawLayer_.rect(this.stageBounds_.left, this.stageBounds_.top, this.stageBounds_.width, this.stageBounds_.height);
  this.interactivityHandler_.fill({color:'#fff', opacity: 0.00001});
  this.interactivityHandler_.zIndex(-1e10);
  this.interactivityHandler_.listen('click', this.clickListener_, false, this);
  this.interactivityHandler_.listen('mousedown', this.mouseDownListener_, false, this);
  this.interactivityHandler_.listen('mouseup', this.mouseUpListener_, false, this);
  this.interactivityHandler_.listen('mousemove', this.mouseMoveListener_, false, this);

  this.zoomingPath_ = this.drawLayer_.path();
  this.zoomingPath_.disablePointerEvents(true);
  this.zoomingPath_.stroke({dash: '3 2', color: 'blue'});
  this.zoomingPath_.zIndex(1e10);

  this.previewContour_ = this.drawLayer_.path();
  this.previewContour_.stroke({dash: '5 3', color: 'red'});
  this.previewContour_.zIndex(-10);
};

Mapper.prototype.clickListener_ = function(e) {
  if (this.addPoints_) { //Adding points
    var xRatio = e.offsetX / this.stageBounds_.width;
    var yRatio = e.offsetY / this.stageBounds_.height;
    var pointsData = {
      pointIndex: this.points_.length,
      xRatio: xRatio,
      yRatio: yRatio,
      originalX: Math.round(xRatio * this.originalImageWidth),
      originalY: Math.round(yRatio * this.originalImageHeight)
    };
    this.points_.push(pointsData);

    var path = this.drawLayer_.path();
    path.fill('yellow');
    acgraph.vector.primitives.diamond(path, e.offsetX, e.offsetY, 5);
    this.pathPoints_.push(path);
    path['mapper_data'] = pointsData;
    path['mapper_index'] = pointsData.pointIndex;

    path.drag(this.stageBounds_);
    path.listen('drag', function() {
      var x = path.getX() + 5; //5 is diamond radius.
      var y = path.getY() + 5; //5 is diamond radius.

      var xRatio = x / this.stageBounds_.width;
      var yRatio = y / this.stageBounds_.height;
      var data = path['mapper_data'];

      data.xRatio = xRatio;
      data.yRatio = yRatio;
      data.originalX = Math.round(xRatio * this.originalImageWidth);
      data.originalY = Math.round(yRatio * this.originalImageHeight);

      this.refreshPreview();
      this.refreshZoomPreview();
      this.refreshZoomPoints();
    }, false, this);

    path.listen('dblclick', function() {
      console.log(path['mapper_index']);
    }, false, this);


    this.refreshPreview();
    this.refreshZoomPreview();
    this.refreshZoomPoints();
  } else {
    //console.log('ZOOMING CLICK');
  }
};


Mapper.prototype.mouseDownListener_ = function(e) {
  if (!this.addPoints_) { //Zooming
    e.preventDefault();

    this.zooming_ = true;
    this.startX_ = e.offsetX;
    this.startY_ = e.offsetY;
    this.zoomingPath_.clear();
    this.zoomingPath_.zIndex(1e10);
    document.body.style.cursor = 'crosshair';
  }
};


Mapper.prototype.mouseUpListener_ = function(e) {
  if (!this.addPoints_) { //Zooming
    this.zooming_ = false;
    e.preventDefault();

    var minX = Math.min(this.startX_, e.offsetX);
    var minY = Math.min(this.startY_, e.offsetY);
    var maxX = Math.max(this.startX_, e.offsetX);

    var selectedAreaWidth = maxX - minX;
    var widthRatio = selectedAreaWidth / this.stageBounds_.width;

    var domInageRatio = this.domImageWidth / this.domImageHeight;
    var zoomImageWrapperWidth = this.zoomImgWrapper.width();
    this.zoomImgWidth = Math.round(zoomImageWrapperWidth / widthRatio);
    this.zoomImgHeight = Math.round(this.zoomImgWidth / domInageRatio);

    var leftRatio = minX / this.stageBounds_.width;
    var topRatio = minY / this.stageBounds_.height;

    this.zoomImgLeftOffset = -leftRatio * this.zoomImgWidth;
    this.zoomImgTopOffset = -topRatio * this.zoomImgHeight;

    this.zoomImgWrapper.empty();
    var newZoomImg = $('<img/>');
    newZoomImg
        .attr('src', this.imgUrl_)
        .css('width', this.zoomImgWidth + 'px')
        .css('height', this.zoomImgHeight + 'px')
        .css('margin-left', this.zoomImgLeftOffset + 'px')
        .css('margin-top', this.zoomImgTopOffset + 'px');

    this.zoomImgWrapper.append(newZoomImg);

    this.zoomingPath_.clear();
    this.startX_ = NaN;
    this.startY_ = NaN;
    document.body.style.cursor = 'auto';

    this.initZoomStage();
    this.refreshZoomPreview();
    this.refreshZoomPoints();
  }
};


Mapper.prototype.mouseMoveListener_ = function(e) {
  if (!this.addPoints_) { //Zooming
    e.preventDefault();
    if (this.zooming_) {
      this.zoomingPath_.clear();
      this.zoomingPath_
          .moveTo(this.startX_, this.startY_)
          .lineTo(this.startX_, e.offsetY)
          .lineTo(e.offsetX, e.offsetY)
          .lineTo(e.offsetX, this.startY_)
          .close();
    }
  }
};


Mapper.prototype.refreshPreview = function() {
  this.previewContour_.clear();
  for (var i = 0; i < this.points_.length; i++) {
    var point = this.points_[i];
    var left = this.stageBounds_.width * point.xRatio;
    var top = this.stageBounds_.height * point.yRatio;
    if (i == 0) {
      this.previewContour_.moveTo(left, top);
    } else {
      this.previewContour_.lineTo(left, top);
    }
  }
  if (this.points_.length > 2)
    this.previewContour_.close();
};


Mapper.prototype.initZoomStage = function() {
  if (!this.zoomStage_) {
    this.zoomStage_ = acgraph.create(this.zoomDrawContainer_);
    this.zoomDrawLayer_ = this.zoomStage_.layer();
    this.zoomPreviewContour_ = this.zoomDrawLayer_.path();
    this.zoomPreviewContour_.stroke({dash: '5 3', color: 'red'});
    this.zoomPreviewContour_.zIndex(-10);
  }
};


Mapper.prototype.refreshPoints = function() {
  for (var i = 0; i < this.points_.length; i++) {
    var point = this.points_[i];
    var left = this.stageBounds_.width * point.xRatio;
    var top = this.stageBounds_.height * point.yRatio;
    var path = this.pathPoints_[i];
    if (path) {
      path.clear();
      path.setTransformationMatrix(1, 0, 0, 1, 0, 0);
      acgraph.vector.primitives.diamond(path, left, top, 5);
    }
  }
};


Mapper.prototype.refreshZoomPreview = function() {
  if (this.zoomStage_) {
    this.zoomPreviewContour_.clear();
    for (var i = 0; i < this.points_.length; i++) {
      var point = this.points_[i];
      var left = this.zoomImgWidth * point.xRatio + this.zoomImgLeftOffset;
      var top = this.zoomImgHeight * point.yRatio + this.zoomImgTopOffset;
      if (i == 0) {
        this.zoomPreviewContour_.moveTo(left, top);
      } else {
        this.zoomPreviewContour_.lineTo(left, top);
      }
    }
    if (this.points_.length > 2)
      this.zoomPreviewContour_.close();

  }
};


Mapper.prototype.refreshZoomPoints = function(opt_exceptIndex) {
  if (this.zoomStage_) {
    for (var i = 0; i < this.points_.length; i++) {
      var point = this.points_[i];
      var left = this.zoomImgWidth * point.xRatio + this.zoomImgLeftOffset;
      var top = this.zoomImgHeight * point.yRatio + this.zoomImgTopOffset;

      var pointPath;
      if (this.zoomPathPoints_[i]) {
        pointPath = this.zoomPathPoints_[i];
      } else {
        pointPath = this.zoomDrawLayer_.path();
        pointPath.fill('yellow');
        this.zoomPathPoints_.push(pointPath);

        var bounds = this.zoomStage_.getBounds();
        pointPath['mapper_data'] = point;
        pointPath.drag(bounds);

        pointPath.listen('drag', this.getClosureHandler_(pointPath, this), false, this);

        // pointPath.listen('end', function() {
        //   this.refreshZoomPoints();
        // }, false, this);
      }

      pointPath.clear();
      pointPath.setTransformationMatrix(1, 0, 0, 1, 0, 0);
      acgraph.vector.primitives.diamond(pointPath, left, top, 5);
    }
  }
};

Mapper.prototype.getClosureHandler_ = function(pointPath, context) {
  return function() {
    var x = pointPath.getX() + 5; //5 is diamond radius.
    var y = pointPath.getY() + 5; //5 is diamond radius.

    var xRatio = (x - context.zoomImgLeftOffset) / context.zoomImgWidth;
    var yRatio = (y - context.zoomImgTopOffset) / context.zoomImgHeight;
    var data = pointPath['mapper_data'];

    data.xRatio = xRatio;
    data.yRatio = yRatio;
    data.originalX = Math.round(xRatio * context.originalImageWidth);
    data.originalY = Math.round(yRatio * context.originalImageHeight);

    context.refreshPreview();
    context.refreshPoints();
    context.refreshZoomPreview();
  }
};


Mapper.prototype.getPointsData = function() {
  return this.points_;
};






/** Package wrapper and layout.
*/
"use strict";
(function (global, init) { // Universal Module Definition.
	if (typeof define === 'function' && define.amd) {
		define(['creatartis-base'], init); // AMD module.
	} else if (typeof module === 'object' && module.exports) {
		module.exports = init(require('creatartis-base')); // CommonJS module.
	} else { // Browser or web worker (probably).
		global.inveniemus = init(global.base);
	}
})(this, function __init__(base){
// Import synonyms. ////////////////////////////////////////////////////////////
	var declare = base.declare,
		initialize = base.initialize,
		iterable = base.iterable,
		raiseIf = base.raiseIf,
		Events = base.Events,
		Future = base.Future,
		Iterable = base.Iterable,
		Logger = base.Logger,
		Randomness = base.Randomness,
		Statistics = base.Statistics;
	
// Library layout. /////////////////////////////////////////////////////////////
	var exports = {
		__name__: 'inveniemus',
		__init__: __init__
	};
	__init__.dependencies = {'creatartis-base': base};

/**	# Element

Element is the term used in Inveniemus for representations of 
[candidate solutions](http://en.wikipedia.org/wiki/Feasible_region) in a search or optimization 
[problem](Problem.js.html). Implementations may declare their own subclass of `Element` to represent
their candidate solutions.
*/
var Element = exports.Element = declare({
	/** All elements are defined by an array of numbers (i.e. the element's `values`, random numbers
	by default) and an `evaluation` (`NaN` by default).
	
	The `values` store all data about the candidate solution this element represents. This may 
	appear to abstract and stark, but it helps	to separate the problem definition from the search
	or optimization strategy.
	
	The element's `evaluation` is a numerical assessment of the represented candidate solution. 
	Usually is a measure of how well the problem is solved, or how close the element is to a real 
	solution. It guides almost all of the metaheuristics.
	*/
	constructor: function Element(values, evaluation) {
		if (typeof values === 'undefined') {
			this.values = this.randomValues();
		} else {
			this.values = values.slice(); // Makes a shallow copy.
		}
		this.evaluation = +evaluation;
	},
	
	/** The class property `length` defines the size of the element's values array (10 by default).
	*/
	length: 10,

	/** All numbers in an element's values range between `minimumValue` (0 by default) and 
	`maximumValue` (1 by default).
	*/
	minimumValue: 0,
	maximumValue: 1,
	
	/** The pseudorandom number generator in the class property `random` is required by some of the
	element's operations. Its equal to `base.Randomness.DEFAULT` by default.
	*/
	random: Randomness.DEFAULT,
	
	/** One of this operations is `randomValue()`, which returns a random value between
	`this.minimumValue` and `this.maximumValue`.
	*/
	randomValue: function randomValue() {
		return this.random.random(this.minimumValue, this.maximumValue);
	},
	
	/** This method is used in `randomValues()` to calculate an array with random numbers, suitable
	to be used as an element's `values`. Many metaheuristics require random initiation of the
	elements they handle.
	*/
	randomValues: function randomValues() {
		var values = new Array(this.length),
			offset = this.minimumValue,
			factor = this.maximumValue - this.minimumValue;
		for (var i = 0; i < this.length; i++) {
			values[i] = this.random.random() * factor + offset;
		}
		return values;
	},
	
	// ## Basic operations #########################################################################
	
	/** The element's evaluation is calculated by `evaluate()`, which assigns and returns this 
	number. It can return a promise if the evaluation has to be done asynchronously. This can be 
	interpreted as the solutions cost in a search problem or the target function of an optimization 
	problem. The default behaviour is adding up this element's values, useful only for testing.
	*/
	evaluate: function evaluate() {
		return this.evaluation = iterable(this.values).sum();
	},

	/** Whether this element is a actual solution or not is decided by `suffices()`. It holds the 
	implementation of the goal test in search problems. More complex criteria may be implemented in 
	`Problem.suffices`. By default it checks if the values add up to zero, again only useful for
	testing purposes.
	*/
	suffices: function suffices() {
		return iterable(this.values).sum() === 0;
	},
	
	/** Usually a numbers array is just too abstract to handle, and	another representation of the 
	candidate solution must be build. For this `mapping()` must be overridden to returns an 
	alternate representation of this element that may be fitter for evaluation or showing it to the
	user. By default it just returns the same `values` array.
	*/
	mapping: function mapping() {
		return this.values;
	},

	/** The `emblem` of an element is a string that represents it and can be displayed to the user. 
	By default returns the JSON conversion of the `values` array.
	*/
	emblem: function emblem() {
		return JSON.stringify(this.mapping());
	},

	// ## Evaluations ##############################################################################

	/** The element's `resolution` is the minimal difference between elements' evaluations, below 
	which two evaluations are considered equal.
	*/
	resolution: 1 / Math.pow(2, 52),
	
	/** The [Hamming distance](http://en.wikipedia.org/wiki/Hamming_distance) between two arrays is 
	the number of positions at which corresponding components are different. Arrays are assumed to 
	be of the same length. If they are not, only the common parts are considered.
	*/
	hammingDistance: function hammingDistance(array1, array2) {
		return iterable(array1).zip(array2).filter(function (pair) {
			return pair[0] != pair[1];
		}).count();
	},

	/** The [Manhattan distance](http://en.wikipedia.org/wiki/Manhattan_distance) between two arrays 
	is the sum of the absolute differences of corresponding positions.
	*/
	manhattanDistance: function manhattanDistance(array1, array2) {
		return iterable(array1).zip(array2).map(function (pair) {
			return Math.abs(pair[0] - pair[1]);
		}).sum();
	},

	/** The [euclidean distance](http://en.wikipedia.org/wiki/Euclidean_distance) between two arrays 
	is another option for evaluation.
	*/
	euclideanDistance: function euclideanDistance(array1, array2) {
		return Math.sqrt(iterable(array1).zip(array2).map(function (pair) {
			return Math.pow(pair[0] - pair[1], 2);
		}).sum());
	},

	/** Another common evaluation is the [root mean squared error](http://en.wikipedia.org/wiki/Root_mean_squared_error).
	The method `rootMeanSquaredError` takes a function `f` (usually a mapping of this element) and 
	some `data`. This `data` must be an iterable of arrays, in which the first element is the 
	expected result and the rest are the arguments for the function.
	*/
	rootMeanSquaredError: function rootMeanSquaredError(f, data) {
		var length = 0,
			error = iterable(data).map(function (datum) {
				length++;
				return Math.pow(datum[0] - f.apply(this, datum.slice(1)), 2);
			}).sum()
		return length == 0 ? 0 : Math.sqrt(error / length);
	},

	// ## Expansions ###############################################################################
	
	/** An element's `successors` are other elements that can be considered adjacent of this 
	element. By default returns the element's neighbourhood with the default radius.
	*/
	successors: function successors(element) {
		return this.neighbourhood();
	},
	
	/** An element's `neighbourhood` is a set of new elements, with values belonging to the n 
	dimensional ball around this element's values with the given `radius` (1% by default). 
	*/
	neighbourhood: function neighbourhood(radius) {
		radius = isNaN(radius) ? (this.maximumValue - this.minimumValue) / 100 : +radius;
		var elems = [], 
			values = this.values,
			i, value;
		for (i = 0; i < values.length; i++) {
			value = values[i] + radius;
			if (value <= this.maximumValue) {
				elems.push(this.modification(i, value));
			}
			value = values[i] - radius;
			if (value >= this.minimumValue) {
				elems.push(this.modification(i, value));
			}
		}
		return elems;
	},
	
	/** The method `modification(index, value, ...)` returns a new and unevaluated copy of this 
	element, with its values modified as specified.
	*/
	modification: function modification() {
		var copy = new this.constructor(this.values), i, v;
		for (i = 0; i < arguments.length; i += 2) {
			v = +arguments[i + 1];
			raiseIf(isNaN(v) || v < this.minimumValue || v > this.maximumValue, "Invalid value ", v, " for element.");
			copy.values[arguments[i] | 0] = +arguments[i + 1];
		}
		return copy;
	},
	
	// ## Mappings #################################################################################
	
	/** An array mapping builds an array of equal length of this element's `values`. Each value is 
	used to index the corresponding items argument. If there are less arguments than the element's 
	`length`, the last one is used for the rest of the values. 
	*/
	arrayMapping: function arrayMapping() {
		var args = arguments, 
			lastItems = args[args.length - 1];
		raiseIf(args.length < 1, "Element.arrayMapping() expects at least one argument.");
		return this.values.map(function (v, i) {
			var items = args.length > i ? args[i] : lastItems;
			return items[v * items.length | 0];
		});
	},
	
	/** A set mapping builds an array of equal length of this element's `values`. Each value is used 
	to select one item. Items are not selected more than once. 
	*/
	setMapping: function setMapping(items) {
		raiseIf(!Array.isArray(items), "Element.setMapping() expects an array argument.");
		items = items.slice(); // Shallow copy.
		return this.values.map(function (v, i) {
			return items.splice(v * items.length | 0, 1)[0];
		});
	},
	
	// ## Other utilities ##########################################################################

	/** A `clone` is a copy of this element.
	*/
	clone: function clone() {
		return new this.constructor(this.values, this.evaluation);
	},
	
	/** Two elements can be compared with `equals(other)`. It checks if the other element has the 
	same values and constructor than this one.
	*/
	equals: function equals(other) {
		if (this.constructor === other.constructor && this.values.length === other.values.length) {
			for (var i = 0, len = this.values.length; i < len; i++) {
				if (this.values[i] !== other.values[i]) {
					return false;
				}
			}
			return true;
		}
		return false;
	},
	
	/** The default string representation of an Element instance has this shape: 
	`"Element(values, evaluation)"`.
	*/
	toString: function toString() {
		return (this.constructor.name || 'Element') +"("+ JSON.stringify(this.values) +", "+ this.evaluation +")";
	}
}); // declare Element.


/**	# Problem

The Problem type represents a search or optimization problem in Inveniemus.
*/
var Problem = exports.Problem = declare({
	/** A problem should have a `title` to be displayed to the user.
	*/
	title: "<no title>",
		
	/** A `description` of the problem to be displayed to the user may also be appreciated.
	*/
	description: "<no description>",

	/** Many operations in this class require a pseudorandom number generator. By default 
	`base.Randomness.DEFAULT` is used.
	*/
	random: Randomness.DEFAULT,
	
	/** A Problem holds basically three things:	
	*/
	constructor: function Problem(params) {
		initialize(this, params)
			.string('title', { coerce: true, ignore: true })
			.string('description', { coerce: true, ignore: true })
			.object('random', { ignore: true })
			/** + `representation`: the element constructor,
			*/
			.func('representation', { ignore: true }) // Overrides.
			/** + `compare`: the comparison between elements,
			*/
			.func('compare', { ignore: true })
			/** + `suffices`: the sufficiency criteria.
			*/
			.func('suffices', { ignore: true });
	},

	/** The problem's candidate solution `representation` is a subclass of [`Element`](Element.js.html).
	*/
	representation: Element,
	
	/** How elements are compared with each other in the problem determines which kind of 
	optimization is performed. The `compare` method implements the comparison between two elements. 
	It follows the standard protocol of comparison functions; i.e. returns a positive number if 
	`element2` is better than `element1`, a negative number if `element2` is worse then `element1`,
	or zero otherwise. 
	
	Better and worse may mean less or greater evaluation (`minimization`), viceversa 
	(`maximization`) or another criteria altogether. The default implementation is `minimization`.
	*/
	compare: function compare(element1, element2) {
		return this.minimization(element1, element2);
	},
		
	/** When a set of elements is sufficient, the search/optimization ends. The
	method `suffices(elements)` returns `true` if inside the elements array 
	there are enough actual solutions to this problem. It holds the 
	implementation of the goal test in search problems. By default calls the 
	`suffice` method of the first element (assumed to be the best one).
	*/
	suffices: function suffices(elements) {
		return elements[0].suffices();
	},
	
	// ## Optimization modes #######################################################################
		
	/** A `maximization` compares two elements by evaluation in descending order.
	*/
	maximization: function maximization(element1, element2) {
		var d = element2.evaluation - element1.evaluation;
		return isNaN(d) ? -Infinity : Math.abs(d) < element1.resolution ? 0 : d;
	},
	
	/** A `minimization` compares two elements by evaluation in ascending order.
	*/
	minimization: function minimization(element1, element2) {
		var d = element1.evaluation - element2.evaluation;
		return isNaN(d) ? Infinity : Math.abs(d) < element1.resolution ? 0 : d;
	},
		
	/** An `approximation` compares two elements by distance of its evaluation to the given target 
	value in ascending order.
	*/
	approximation: function approximation(target, element1, element2) {
		var d = Math.abs(element1.evaluation - target) - Math.abs(element2.evaluation - target);
		return isNaN(d) ? Infinity : Math.abs(d) < element1.resolution ? 0 : d;
	},
		
	// ## Utilities ################################################################################
	
	/** The default string representation of a Problem instance has this shape: 
	`"Problem(params)"`.
	*/
	toString: function toString() {
		return (this.constructor.name || 'Problem') +"("+ JSON.stringify(this) +")";
	}
}); // declare Problem.
		
/** `problems` is a bundle of classic and reference problems.
*/
var problems = exports.problems = {};


/**	# Metaheuristic

A [Metaheuristic](http://en.wikipedia.org/wiki/Metaheuristic) is an optimization
algorithm (which can also be used for searching). This is the base class of all
metaheuristic algorithms, and hence of all metaheuristic runs.
*/
var Metaheuristic = exports.Metaheuristic = declare({
	/** Each metaheuristic has its own `logger`, to track its process.
	*/
	logger: new Logger('inveniemus', Logger.ROOT, 'INFO'),
	
	/** The constructor takes a `params` object with the metaheuristic 
	parameters. Although the different algorithms have particular parameters of
	their own, some apply to all.
	*/
	constructor: function Metaheuristic(params) {
		initialize(this, params)
		/** First, the definition of the `problem` this metaheuristic is meant
		to solve.
		*/
			.object('problem', { defaultValue: null })
		/** The optimization's `size` is the amount of candidate solutions the 
		metaheuristic treats at each step. By default it is 100.
		*/
			.number('size', { defaultValue: 100, coerce: true })
		/** The `state` is the array that holds the elements this metaheuristic 
		handles at each step.
		*/
			.array('state', { defaultValue: [] })
		/** All optimizations perform a certain number of iterations or `steps`
		(100 by default).
		*/
			.number('steps', { defaultValue: 100, coerce: true })
		/** The property `step` indicates the current iteration of this 
		optimization, or a negative number if it has not started yet.
		*/
			.integer('step', { defaultValue: -1, coerce: true })
		/** Most metaheuristic are stochastic processes, hence the need for a
		pseudo-random number generator. By default `base.Randomness.DEFAULT` is 
		used, yet it is strongly advised to provide one.
		*/
			.object('random', { defaultValue: Randomness.DEFAULT })
		/** Metaheuristic's runs usually gather `statistics` about the process.
		*/
			.object('statistics', { defaultValue: new Statistics() })
			.object('logger', { ignore: true });
		/** For better customization the `events` handler emits the following
		events: 
		
		+ `initiated` when the state has been initialized.
		+ `updated` when the state has been expanded, evaluated and sieved.
		+ `expanded` after new elements are added to the state.
		+ `evaluated` after the elements in the state are evaluated.
		+ `sieved` after elements are removed from the state.
		+ `advanced` when one full iteration is completed.
		+ `analyzed` after the statistics are calculated.
		+ `finished` when the run finishes.
		*/
		this.events = new Events({ 
			events: ["initiated", "updated", "expanded", "evaluated", "sieved", 
				"advanced", "analyzed", "finished"]
		});
	},
	
	// ## Basic workflow #######################################################
	
	/**	`initiate(size=this.size)` builds and initiates this metaheuristic state 
	with size new cursors. The elements are build using the `initial()` 
	function.
	*/
	initiate: function initiate(size) {
		size = isNaN(size) ? this.size : +size >> 0;
		this.state = new Array(size);
		for (var i = 0; i < size; i++) {
			this.state[i] = new this.problem.representation(); // Element with random values.
		}
		this.events.emit('initiated', this);
		this.logger && this.logger.debug('State has been initiated. Nos coepimus.');
	},
	
	/** `update()` updates this metaheuristic's state. It assumes the state has 
	been initialized. The process may be asynchronous, so it returns a future.
	The default implementation first expands the state by calling `expand()`, 
	then evaluates the added elements by calling `evaluate()`, and finally 
	removes the worst elements with `sieve()`.
	*/
	update: function update() {
		var mh = this;
		this.expand();
		return this.evaluate().then(function () {
			mh.sieve();
			mh.events.emit('updated', this);
			return mh;
		});
	},
	
	/** `expand(expansion=[])` adds to this metaheuristic's state the given 
	expansion. If none is given, `expansion()` is called to get new expansion.
	*/
	expand: function expand(expansion) {
		expansion = expansion || this.expansion();
		if (expansion.length < 1) {
			this.logger && this.logger.warn("Expansion is empty");
		} else {
			var expanded = this.state.concat(expansion),
				len = expanded.length;
			expanded = expanded.filter(function (elem, i) { // Trim equal elements from the expanded state.
				for (i++; i < len; i++) {
					if (elem.equals(expanded[i])) {
						return false;
					}
				}
				return true;
			});
			this.state = expanded;
		}
		this.events.emit('expanded', this);
		this.logger && this.logger.debug('State has been expanded. Nos exploramus.');
	},
	
	/** `expansion(size)` returns an array of new elements to add to the current 
	state. The default implementation generates new random elements.		
	*/
	expansion: function expansion(size) {
		var expansionRate = isNaN(this.expansionRate) ? 0.5 : +this.expansionRate;
		size = isNaN(size) ? Math.floor(expansionRate * this.size) : +size;
		var elems = new Array(size), i;
		for (i = 0; i < size; i++){
			elems[i] = new this.problem.representation();
		}
		return elems;
	},
	
	/** `evaluate(elements)` evaluates all the elements in `state` with no 
	evaluation, using its evaluation method. After that sorts the state with 
	the `compare` method of the problem. Returns a future, regardless of the 
	evaluation being asynchronous or not.
	*/
	evaluate: function evaluate(elements) {
		var mh = this,
			evalTime = this.statistics.stat({key:'evaluation_time'});
		evalTime.startTime();
		elements = elements || this.state;
		return Future.all(iterable(elements).filter(
			function (element) { // For those elements that don't have an evaluation, ...
				return isNaN(element.evaluation);
			},
			function (element) { // ... evaluate them.
				return Future.when(element.evaluate());
			}
		)).then(function (results) {
			elements.sort(mh.problem.compare.bind(mh.problem));
			evalTime.addTime();
			mh.events.emit('evaluated', this);
			mh.logger && mh.logger.debug('Evaluated and sorted ', results.length, ' elements. Appretiatus sunt.');
			return elements;
		});
	},
	
	/** `sieve(size=this.size)` cuts the current state down to the given size 
	(or this.size by default). This is usually used after expanding and 
	evaluating the state.
	*/
	sieve: function sieve(size) {
		size = isNaN(size) ? this.size : size | 0;
		if (this.state.length > size) {
			this.state = this.state.slice(0, this.size);
		}
		this.events.emit('sieved', this);
		this.logger && this.logger.debug('State has been sieved. Viam selectus est.');
	},
	
	/** `finished()` termination criteria for this metaheuristic. By default it 
	checks if the number of passed iterations is not greater than `steps`.
	*/
	finished: function finished() {
		if (this.step >= this.steps || this.problem.suffices(this.state)) {
			this.events.emit('finished', this);
			return true;
		}
		return false;
	},

	/** `analyze()` updates the process' statistics.
	*/
	analyze: function analyze() {
		var stat = this.statistics.stat({key:'evaluation', step: this.step});
		this.state.forEach(function (element) {
			stat.add(element.evaluation, element);
		});
		this.events.emit('analyzed', this);
		return stat;
	},
	
	/** `advance()` performs one step of the optimization. If the process has 
	not been initialized, it does so. Returns a future if the run has not 
	finished or null otherwise.
	*/
	advance: function advance() {
		var mh = this, 
			stepTime = this.statistics.stat({key: 'step_time'}),
			result;
		if (isNaN(this.step) || +this.step < 0) {
			this.statistics.reset();
			stepTime.startTime();
			this.initiate();
			result = this.evaluate();
		} else {
			stepTime.startTime();
			result = this.update();
		}
		return result.then(function () {
			mh.step = isNaN(mh.step) || +mh.step < 0 ? 0 : +mh.step + 1;
			mh.analyze(); // Calculate the state's stats after updating it.
			stepTime.addTime();
			mh.events.emit('advanced', this);
			mh.logger && mh.logger.info('Step ', mh.step , ' has been completed. Nos proficimus.');
			return mh;
		});
	},
	
	/** `run()` returns a future that is resolved when the whole search process 
	is finished. The value is the best cursor after the last step.
	*/
	run: function run() {
		var mh = this, 
			advance = this.advance.bind(this);
		function continues() {
			return !mh.finished();
		}
		return Future.doWhile(advance, continues).then(function () {
			mh.logger && mh.logger.info('Finished. Nos invenerunt!');
			return mh.state[0]; // Return the best cursor.
		});
	},

	/** `reset()` reset the process to start over again. Basically cleans the 
	statistics and sets the current `step` to -1.
	*/
	reset: function reset() {
		this.step = -1;
		this.statistics.reset();
	},
	
	// ## Utilities ############################################################
	
	/** The default string representation of a Metaheuristic shows its 
	constructor's name and its parameters.
	*/
	toString: function toString() {
		return (this.constructor.name || 'Metaheuristic') +"("+ JSON.stringify(this) +")";
	}	
}); // declare Metaheuristic.

/** `metaheuristics` is a bundle of available metaheuristics.
*/
var metaheuristics = exports.metaheuristics = {};

/** # Hill climbing

[Hill Climbing](http://en.wikipedia.org/wiki/Hill_climbing) is a simple iterative local search 
method. The state has only one element, and in each iteration its best successor replaces it, after
a local optimum is reached.
*/
var HillClimbing = metaheuristics.HillClimbing = declare(Metaheuristic, {
	/** The constructor takes an extra `delta=0.01` parameter. This is the radius of the elements 
	surroundings in every dimension, that is checked by this algorithm.
	*/
	constructor: function HillClimbing(params) {
		Metaheuristic.call(this, params);
		initialize(this, params)
			.number('delta', { defaultValue: 0.01, coerce: true })
		/** Also, the state's size is constrained to 1 by default. This may be increased, resulting 
		in many parallel climbings.
		*/
			.integer('size', { defaultValue: 1,	coerce: true });
	},
	
	/** The hill climbings `update()` replaces each element in the state by the best element in its 
	neighbourhood, if there is any. The surroundings have all possible elements resulting from 
	either an increment or decrement (of the given `delta`) in each of the centre element's 
	dimensions.
	*/
	update: function update() {
		var mh = this, 
			localOptima = 0;
		return Future.all(this.state.map(function (elem) {
			var range = elem.neighbourhood(mh.delta);
			range.push(elem);
			return mh.evaluate(range).then(function (range) {
				var best = range[0];
				if (elem === best) {
					localOptima++;
				}
				return best;
			});			
		})).then(function (elems) {
			mh.state = elems;
			mh.__localOptima__ = localOptima;
		});
	},
		
	/** `atLocalOptima()` checks if the search is currently stuck at a local optima.
	*/
	atLocalOptima: function atLocalOptima() {
		return this.__localOptima__ >= this.state.length;
	},
		
	/** A hill climbing search must finish when a local optimum is reached. This criteria is tested 
	together with all others.
	*/
	finished: function finished() {
		return Metaheuristic.prototype.finished.call(this) || this.atLocalOptima();
	},
		
	toString: function toString() {
		return (this.constructor.name || 'HillClimbing') +'('+ JSON.stringify(this) +')';
	}
}); // declare HillClimbing.


/** # Genetic algorithm

Classic Holland's-style [genetic algorithms](http://en.wikipedia.org/wiki/Genetic_algorithm),
which is the base for many evolutionary computing variants.
*/
var GeneticAlgorithm = metaheuristics.GeneticAlgorithm = declare(Metaheuristic, {
	/** The constructor takes many parameters specific for this technique:
	*/
	constructor: function GeneticAlgorithm(params) {
		Metaheuristic.call(this, params); // Superconstructor call.
		initialize(this, params)
		/** + `expansionRate=0.5` is the amount of new elements generated by 
		crossover, as a ratio of the population size.
		*/
			.number('expansionRate', { defaultValue: 0.5, minimum: 0, coerce: true })
		/** + `mutationRate=0.2` is the chance of a new element (resulting from 
		crossover) mutating.
		*/
			.number('mutationRate', { defaultValue: 0.2, minimum: 0, maximum: 1, coerce: true })
		/** `selection(count)` is a function that selects count elements from 
		the current population. These will be the parents of the new elements in 
		the next generation.
		
		By default rank selection is used, a.k.a. fitness proportional to 
		position in the state.
		*/
			.func('selection', { defaultValue: GeneticAlgorithm.selections.rankSelection })
		/** `crossover(parents)` is a function implementing the genetic operator 
		that simulates reproduction with inheritance. The parents argument must 
		be an array of elements. The result is an array of elements.
		
		By default the single point crossover is used.
		*/
			.func('crossover', { defaultValue: GeneticAlgorithm.crossovers.singlepointCrossover })
		/** `mutation(element)` is a function implementing the genetic operator 
		that simulates biological mutation, making a random change in the 
		chromosome.
		
		By default a single point uniform mutation is used.
		*/
			.func('mutation', { defaultValue: GeneticAlgorithm.mutations.singlepointUniformMutation });
	},

	/** The population's (state) `expansion()` is the possibly mutated 
	crossovers of selected elements. How many is determined by `expansionRate`.
	*/
	expansion: function expansion() {
		var parents, childs, child,
			newElements = [],
			len = Math.floor(this.expansionRate * this.size);
		len += len % 2; // Make len even.
		for (var i = 0; i < len; i += 2) {
			parents = this.selection();
			childs = this.crossover(parents);
			for (var j = 0; j < childs.length; j++) {
				child = this.random.randomBool(this.mutationRate) ? this.mutation(childs[j]) : childs[j];
				newElements.push(child);
			}
		}
		return newElements;
	},
	
	toString: function toString() {
		return (this.constructor.name || 'GeneticAlgorithm')+ '('+ JSON.stringify(this) +')';
	}
}); // declare GeneticAlgorithm.

/** ## Selection methods #######################################################

`GeneticAlgorithm.selections` is a bundle of standard selection methods. A 
selection function takes the amount of elements to be selected and returns an 
array of selected elements. The implemented methods are:
*/
GeneticAlgorithm.selections = {
	/** + `rankSelection(count=2)` makes a selection where each element's 
		probability of being selected is proportional to its position in the state.
	*/
	rankSelection: function rankSelection(count) {
		count = isNaN(count) ? 2 : +count;
		var len = this.state.length,
			randoms = this.random.randoms(count, 0, len * (len + 1) / 2 - 1),
			selected = [];
		randoms.sort(function (x, y) { 
			return x - y; 
		});
		this.state.forEach(function (element) {
			for (var i = 0; i < count; i++) {
				randoms[i] += i - len;
			}
			if (randoms[0] <= 0) {
				selected.push(element);
				randoms.shift();
			}
		});
		if (selected.length < count) { // Should not happen.
			selected = selected.concat(this.state.slice(0, count - selected.length));
		}
		return selected;
	},
	
	/** + `rouletteSelection(count=2)` makes a selection where each element's 
		probability of being selected is proportional to its evaluation.
		Warning! This selection assumes the evaluation is being maximized.
	*/
	rouletteSelection: function rouletteSelection(count) { //FIXME
		count = isNaN(count) ? 2 : +count;
		var len = this.state.length,
			evaluationStat = this.statistics.stat({key: 'evaluation', step: this.step}),
			min = evaluationStat.minimum(),
			sum = evaluationStat.sum(),
			randoms = this.random.randoms(count, 0, sum - len * min),
			selected = [];
		randoms.sort(function (x, y) { return x-y; });
		this.state.forEach(function (element) {
			for (var i = 0; i < count; i++) {
				randoms[i] += i - len;
			}
			if (randoms[0] <= 0) {
				selected.push(element);
				randoms.shift();
			}
		});
		if (selected.length < count) { // Should not happen.
			selected = selected.concat(this.state.slice(0, count - selected.length));
		}
		return selected;
	}
}; // GeneticAlgorithm.selections

/** ## Crossover methods #######################################################

`GeneticAlgorithm.crossovers` is a bundle of standard crossover methods. A 
crossover function takes an array of parent elements and returns an array of 
sibling elements. The implemented methods are:
*/
GeneticAlgorithm.crossovers = {
	/** + `singlepointCrossover(parents)` given two parents returns an array of 
	two new elements built with one half of each parent. The cutpoint is chosen 
	randomly.
	*/
	singlepointCrossover: function singlepointCrossover(parents) {
		raiseIf(!Array.isArray(parents) || parents.length < 2, "A two parent array is required.");
		var cut = this.random.randomInt(this.length - 1) + 1,
			values0 = parents[0].values,
			values1 = parents[1].values,
			elementConstructor = this.problem.representation;
		return [ 
			new elementConstructor(values0.slice(0, cut).concat(values1.slice(cut))),
			new elementConstructor(values1.slice(0, cut).concat(values0.slice(cut)))
		];
	}	
}; // GeneticAlgorithm.crossovers
	
/** ## Mutation methods ########################################################

`GeneticAlgorithm.mutations` is a bundle of standard mutation methods. 
A mutation function takes an element and returns a new element which is a 
variation of the former. The implemented methods are:
*/
GeneticAlgorithm.mutations = {
	/** + `singlepointUniformMutation(element)` sets a randomly selected gene to 
	a uniform random value.
	*/
	singlepointUniformMutation: function singlepointUniformMutation(element) {
		return element.modification(this.random.randomInt(element.length), element.randomValue());
	},
		
	/** + `uniformMutation(maxPoints=Infinity)` builds a mutation function that 
	makes at least one and up to `maxPoints` mutations, changing a randomly 
	selected gene to a uniform random value.
	*/
	uniformMutation: function uniformMutation(maxPoints) {
		max = isNaN(maxPoints) ? Infinity : +maxPoints;
		return function mutation(element) {
			var times = maxPoints;
			element = new element.constructor(element.values); // Copy element.
			do {
				element.values[this.random.randomInt(element.length)] = element.randomValue();
			} while (this.random.randomBool(this.mutationRate) && --times > 0);
			return element;
		};
	},
	
	/** + `singlepointBiasedMutation(element)` sets a randomly selected gene to 
	random deviation of its value, with a triangular distribution.
	*/
	singlepointBiasedMutation: function singlepointBiasedMutation(element) {
		return element.modification(this.random.randomInt(element.length),
			Math.max(element.minimumValue, Math.min(element.maximumValue, 
				element.values[i] + this.random.random() - this.random.random()
			))
		);
	}
}; // GeneticAlgorithm.mutations


/** # Beam search

[Beam search](http://en.wikipedia.org/wiki/Beam_search) is a form of parallel 
best-first search with limited memory.
*/
var BeamSearch = metaheuristics.BeamSearch = declare(Metaheuristic, {
	/** The constructor does not take any special parameters.
	*/
	constructor: function BeamSearch(params) {
		Metaheuristic.call(this, params);
	},
	
	/** `successors(element)` returns the elements' successors. The problem's 
	element must have its `successors` method implemented.
	*/
	successors: function successors(element) {
		return element.successors();
	},
	
	/** The expansion in beam search adds all successors of all elements to the
	state. After being evaluated and sieved only the best will remain.
	*/
	expansion: function expansion() {
		var allSuccessors = [],
			successors = this.successors.bind(this);
		this.state.forEach(function (element) {
			allSuccessors = allSuccessors.concat(successors(element));
		});
		return allSuccessors;
	},
		
	toString: function toString() {
		return (this.constructor.name || 'BeamSearch') +'('+ JSON.stringify(this) +')';
	}
}); // declare BeamSearch.


/** # Simulated annealing

[Simulated annealing](http://en.wikipedia.org/wiki/Simulated_annealing) is a stochastic global 
optimization technique.
*/
var SimulatedAnnealing = metaheuristics.SimulatedAnnealing = declare(Metaheuristic, {
	/** The constructor takes some specific parameters for this search:
	*/
	constructor: function SimulatedAnnealing(params) {
		Metaheuristic.call(this, params);
		initialize(this, params)
		/** + `maximumTemperature=1` is the temperature at the start of the run.
		*/
			.number('maximumTemperature', { defaultValue: 1, coerce: true })
		/** + `minimumTemperature=0` is the temperature at the end of the run.
		*/
			.number('minimumTemperature', { defaultValue: 0, coerce: true })
		/** + `delta=0.01` is the radius of the elements surroundings in every 
		dimension, that is checked by this algorithm.
		*/
			.number('delta', { defaultValue: 0.01, coerce: true })
		/** + `size=1` is 1 by default, but larger states are supported.
		*/
			.integer('size', { defaultValue: 1,	coerce: true })
		/** + `temperature=coolingSchedule.linear` is the temperature function.
		*/
			.func('temperature', { defaultValue: this.coolingSchedule.linear });
	},
	
	/** `randomNeighbour(element, radius=this.delta)` returns one neighbour of the given element 
	chosen at random.
	*/
	randomNeighbour: function randomNeighbour(element, radius) {
		radius = isNaN(radius) ? this.delta : +radius;
		var i = this.random.randomInt(element.values.length), 
			v = element.values[i];
		if (this.random.randomBool()) {
			v = Math.min(element.maximumValue, v + radius);
		} else {
			v = Math.max(element.minimumValue, v - radius);
		}
		return element.modification(i, v);
	},
	
	/** The `acceptance(current, neighbour, temp=this.temperature())` is the probability of 
	accepting the new element. Uses the original definitions from 
	[Kirkpatrick's paper](http://citeseerx.ist.psu.edu/viewdoc/summary?doi=10.1.1.123.7607).
	*/
	acceptance: function acceptance(current, neighbour, temp) {
		temp = isNaN(temp) ? this.temperature() : +temp;
		if (this.problem.compare(current, neighbour) > 0) {
			return 1; // Should always accept a better neighbour.
		} else {
			var d = -Math.abs(neighbour.evaluation - current.evaluation);
			return Math.max(0, Math.min(1, Math.exp(d / temp)));
		}
	},
	
	/** The annealings temperature is a metaphore for the amount of randomness the process applies. 
	The cooling schedule is a function that calculates the temperature for any given step in the
	optimization.
	*/
	coolingSchedule: {
		linear: function temperature() {
			return (1 - Math.max(0, this.step) / this.steps) * 
				(this.maximumTemperature - this.minimumTemperature) + this.minimumTemperature;
		}
	},
	
	/** At every iteration, for each element in the state one of its neighbours is chosen randomly. 
	If the neighbour is better, it replaces the corresponding element. Else it may still do so, but 
	with a probability calculated by `acceptance()`.
	*/
	update: function update() {
		var mh = this,
			temp = this.temperature(),
			acceptanceStat = this.statistics.stat({key: 'acceptance'}),
			temperatureStat = this.statistics.stat({key: 'temperature'});
		temperatureStat.add(temp, this.step);
		return Future.all(this.state.map(function (elem) {
			var neighbour = mh.randomNeighbour(elem);
			return Future.when(neighbour.evaluate()).then(function () {
				var p = mh.acceptance(elem, neighbour, temp);
				acceptanceStat.add(p, neighbour);
				return mh.random.randomBool(p) ? neighbour : elem;
			});
		})).then(function (elems) {
			return mh.state = elems;
		});
	},

	toString: function toString() {
		return (this.constructor.name || 'SimulatedAnnealing') +'('+ JSON.stringify(this) +')';
	}
}); // declare SimulatedAnnealing.


/** # Particle swarm

[Particle Swarm](http://en.wikipedia.org/wiki/Particle_swarm_optimization) is an stochastic 
optimization technique. Every candidate solution is treated as a particle with a position and a 
velocity. On each iteration the positions and velocities of every particle are updated considering
the best positions so far.
*/
var ParticleSwarm = metaheuristics.ParticleSwarm = declare(Metaheuristic, {
	/** The constructor takes some specific parameters for this search:
	*/
	constructor: function ParticleSwarm(params) {
		Metaheuristic.call(this, params);
		initialize(this, params)
		/** + `inertia=1` is the weight of the particle's current velocity in the velocity update.
		*/
			.number('inertia', { defaultValue: 1, coerce: true })
		/** + `localAcceleration=0.5` is the weight of the particle's current best position in the 
				velocity update.
		*/
			.number('localAcceleration', { defaultValue: 0.5, coerce: true })
		/** + `globalAcceleration=0.3` is the weight of the whole swarm's current best position in 
				the velocity update.
		*/
			.number('globalAcceleration', { defaultValue: 0.3, coerce: true });
	},
	
	/** The elements in a particle swarm have two added properties which have to be initialized:
	
	+ `__velocity__` is the vector that defines the movement of the particle. Initially it is a 
		random vector.
	+ `__localBest__` is the best position of the particle in the run. The first position has 
		itself as the best so far.
	*/
	initiate: function initiate(size) {
		Metaheuristic.prototype.initiate.call(this, size);
		var mh = this;
		this.state.forEach(function (element) {
			var range = element.maximumValue - element.minimumValue
			element.__velocity__ = mh.random.randoms(element.length, -range, range);
			element.__localBest__ = element;
		});
	},
	
	/** The method `nextVelocity` calculates the velocity of the particle for the next iteration.
	*/
	nextVelocity: function nextVelocity(element, globalBest) {
		var mh = this,
			velocity = element.__velocity__,
			localBest = element.__localBest__,
			localCoef = this.random.random() * this.localAcceleration,
			globalCoef = this.random.random() * this.globalAcceleration;
		return element.values.map(function (v, i) {
			return velocity[i] * mh.inertia
				+ localCoef * (localBest.values[i] - v)
				+ globalCoef * (globalBest.values[i] - v);
		});
	},
	
	/** The method `nextElement` creates a new element which represents the position of a particle 
	in the next iteration.
	*/
	nextElement: function nextElement(element, globalBest) {
		var mh = this,
			nextVelocity = this.nextVelocity(element, globalBest),
			nextValues = element.values.map(function (v, i) {
				return Math.max(element.minimumValue, Math.min(element.maximumValue, v + nextVelocity[i]));
			}),
			result = new element.constructor(nextValues);
		return Future.when(result.evaluate()).then(function () {
			result.__velocity__ = nextVelocity;
			result.__localBest__ = mh.problem.compare(element.__localBest__, result) > 0 ? result : element.__localBest__;
			return result;
		});		
	},
	
	/** Updating the optimization state means updating each particle velocity and recalculating 
	their positions. The best position of the whole run is stored in the `__globalBest__` property,
	and updated every time a new best position is achieved. If nothing fails, in the end the 
	particles should converge at this position.
	*/
	update: function update() {
		var mh = this,
			globalBest = this.__globalBest__;
		if (!globalBest) {
			globalBest = this.__globalBest__ = this.state[0];
		}
		return Future.all(this.state.map(function (element) {
			return mh.nextElement(element, globalBest);
		})).then(function (elements) {
			mh.state = elements;
			elements.sort(mh.problem.compare.bind(mh.problem));
			if (mh.problem.compare(mh.__globalBest__, elements[0]) > 0) {
				mh.__globalBest__ = elements[0];
			}
			return mh;
		});
	},
		
	toString: function toString() {
		return (this.constructor.name || 'ParticleSwarm') +'('+ JSON.stringify(this) +')';
	}
}); // declare ParticleSwarm.


/** # Sum optimization problem

A class of very simple problems that deal with optimizing the sum of the elements' values. Probably 
the simplest optimization problem that can be defined, included here for testing purposes.
*/
problems.SumOptimization = declare(Problem, {
	title: "Sum optimization",
	description: "Very simple problem based on optimizing the elements' values sum.",

	/** This very simple problem is based on optimizing the elements' values sum. The `target` 
	number determines which way the optimization goes.
	*/
	constructor: function SumOptimization(params) {
		Problem.call(this, params);
		initialize(this, params)
			.number('target', { coerce: true, defaultValue: -Infinity });
	},
	
	representation: declare(Element, {
		evaluate: function evaluate() {
			return this.evaluation = iterable(this.values).sum();
		}
	}),
	
	/** A state `suffices(elements)` when the best element's values add up to the target value.
	*/
	suffices: function suffices(elements) {
		return iterable(elements[0].values).sum() === this.target;
	},
	
	/** The comparison between elements depends on this problem's target. For a `Infinity` 
	maximization is applied, for `-Infinity` minimization, and for every other number approximation.
	*/
	compare: function compare(element1, element2) {
		return this.target === -Infinity ? this.minimization(element1, element2)
			: this.target === Infinity ? this.maximization(element1, element2)
			: this.approximation(this.target, element1, element2);
	}
}); // declare SumOptimization.


/** # _"Hello World"_ problem

As it sounds, `HelloWorld` is a simple problem class, probably only useful for testing purposes.
*/
problems.HelloWorld = declare(Problem, { 
	title: "Hello world",
	description: "Simple problem where each element is a string, and the "+
		"optimization goes towards the target string.",
	
	/** In this simple problem each element is a string, and the optimization goes towards the 
	target string. The string to match is specified by the `target` parameter (`"Hello world!"` by 
	default).
	*/	
	constructor: function HelloWorld(params){
		Problem.call(this, params);
		initialize(this, params)
			.string('target', { coerce: true, defaultValue: 'Hello world!' });
		
		var target = this.target,
			__target__ = iterable(target).map(function (c) {
				return c.charCodeAt(0);
			}).toArray();
		/** The elements` representation is _ad-hoc_.
		*/
		this.representation = declare(Element, {
			/** The elements` `length` is equal to the length of the target string.
			*/
			length: target.length,
			/** The elements` values must be between 32 (space) and 254.
			*/
			minimumValue: 32,
			maximumValue: 254,
			/** An element `suffices()` when its equal to the target string.
			*/
			suffices: function suffices() {
				return this.mapping() === target;
			},
			/** An element evaluation is equal to its distance from target string.
			*/
			evaluate: function evaluate() {
				return this.evaluation = this.manhattanDistance(__target__, this.values);
			},
			/** An element's values are always numbers. These are converted to a string by 
			converting each number to its corresponding Unicode character.
			*/
			mapping: function mapping() {
				return iterable(this.values).map(function (n) {
					return String.fromCharCode(n | 0);
				}).join('');
			}
		});
	},
	
	/** Since elements' evaluation is a distance, this value must be minimized to guide the search 
	towards the target string.
	*/
	compare: Problem.prototype.minimization
}); // declare HelloWorld.


/** # N queens puzzle problem

A generalized version of the classic [8 queens puzzle](http://en.wikipedia.org/wiki/Eight_queens_puzzle),
a problem of placing 8 chess queens on an 8x8 chessboard so that no two queens may attack each 
other.
*/
problems.NQueensPuzzle = declare(Problem, { ////////////////////////////
	title: "N-queens puzzle",
	description: "Generalized version of the classic problem of placing "+
		"8 chess queens on an 8x8 chessboard so that no two queens attack each other.",
	
	/** The constructor takes only one particular parameter:
	*/	
	constructor: function NQueensPuzzle(params){
		Problem.call(this, params);
		initialize(this, params)
			/** + `N=8`: the number of queens and both dimensions of the board.
			*/
			.integer('N', { coerce: true, defaultValue: 8 });
		
		var rowRange = Iterable.range(this.N).toArray();
		/** The representation is an array of `N` positions, indicating the row of the queen for 
		each column.
		*/
		this.representation = declare(Element, {
			length: this.N,
			/** Its evaluation is the count of diagonals shared by queens pairwise.
			*/
			evaluate: function evaluate() {
				var rows = this.mapping(),
					count = 0;
				rows.forEach(function (row, i) {
					for (var j = 1; i + j < rows.length; j++) {
						if (rows[j] == row + j || rows[j] == row - j) {
							count++;
						}
					}
				});
				return this.evaluation = count;
			},
			/** It is sufficient when no pair of queens share diagonals.
			*/
			suffices: function suffices() {
				return this.evaluation === 0;
			},
			mapping: function mapping() {
				return this.setMapping(rowRange);
			}
		});
	},
	
	/** Of course, the number of shared diagonals must be minimized.
	*/
	compare: Problem.prototype.minimization
}); // declare NQueensPuzzle


/** # Knapsack problem

The [Knapsack problem](http://en.wikipedia.org/wiki/Knapsack_problem) is a classic combinatorial 
optimization problem. Given a set of items, each with cost and worth, a selection must be obtained 
(to go into the knapsack) so that the total cost does not exceed a certain limit, while maximizing 
the total worth.
*/
problems.KnapsackProblem = declare(Problem, {
	title: "Knapsack problem",
	description: "Given a set of items with a cost and a worth, select a subset "+
		" maximizing the worth sum but not exceeding a cost limit.",
	
	/** `items` is the superset of all candidate solutions. Must be an object with each item by 
	name. Each item must have a cost and a worth, and may have an amount (1 by default).
	*/
	items: {
		itemA: { cost: 12, worth:  4 }, 
		itemB: { cost:  2, worth:  2 }, 
		itemC: { cost:  1, worth:  2 }, 
		itemD: { cost:  1, worth:  1 },
		itemE: { cost:  4, worth: 10 }
	},
	
	/** The problem is based on a given a set of items, each with a cost and a worth. The solution 
	is a subset of items with maximum worth sum that does not exceed a cost limit.
	
	The parameters specific for this problem are:
	*/	
	constructor: function KnapsackProblem(params){
		Problem.call(this, params);
		initialize(this, params)
			/** + `limit=15` is the cost limit that candidate solution should not exceed.
			*/
			.number('limit', { coerce: true, defaultValue: 15 })
			/** + `defaultAmount=1` is the amount available for each item by default.
			*/
			.integer('amount', { coerce: true, defaultValue: 1, minimum: 1 })
			/** + `items` is the set of items.
			*/
			.object('items', { ignore: true });
		
		var problem = this;
		/** The problem's representation is declared _ad hoc_. It is an array with a number for each
		item. This number holds the selected amount for each item (from 0 up to the item's amount).
		*/
		this.representation = declare(Element, {
			length: Object.keys(this.items).length,
			/** All elements are evaluated by calculating the worth of all included items. If their 
			cost is greater than the problem's limit, the worth becomes negative.
			*/
			evaluate: function evaluate() {
				var selection = this.mapping(),
					worth = 0,
					cost = 0;
				Object.keys(selection).forEach(function (name) {
					var item = problem.items[name],
						amount = selection[name];
					worth += item.worth * amount;
					cost += item.cost * amount;
				});
				return this.evaluation = cost > problem.limit ? -worth : worth;
			},
			/** All elements are mapped to an object with the selected amount associated to each 
			item.
			*/
			mapping: function mapping() {
				var selection = {},
					keys = Object.keys(problem.items);
				keys.sort();
				iterable(this.values).zip(keys).forEach(function (pair) {
					var item = problem.items[pair[1]],
						amount = pair[0] * (1 + (+item.amount || 1)) | 0;
					selection[pair[1]] = amount;
				});
				return selection;
			}
		});
	},
	
	/** The best selection of items is the one that maximizes worth, without exceeding the cost 
	limit.
	*/
	compare: Problem.prototype.maximization
}); // declare KnapsackProblem

// See __prologue__.js
	return exports;
});

//# sourceMappingURL=inveniemus.js.map
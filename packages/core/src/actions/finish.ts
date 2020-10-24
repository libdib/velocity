/*
 * velocity-animate (C) 2014-2018 Julian Shapiro.
 *
 * Licensed under the MIT license. See LICENSE file in the project root for details.
 *
 * Finish all animation.
 */

import type { IAnimation } from "../core/animation";
import { isAnimation } from "../types";
import { completeCall } from "../core/complete";
import { setPropertyValue } from "../core/css/setPropertyValue";
import { defaults } from "../core/defaults";
import { validateQueue } from "../core/options";
import { State } from "../core/state";
import { beginCall } from "../core/tick";
import { validateTweens } from "../core/tweens";
import { registerAction } from "./registerAction";
import { IActionThis } from "./actionsObject";
import { AnimationCall } from "../core/animationCall";

/**
 * Check if an animation should be finished, and if so we set the tweens to
 * the final value for it, then call complete.
 */
function checkAnimationShouldBeFinished(animation: AnimationCall, queueName?: false | string, defaultQueue?: false | string) {
	validateTweens(animation);
	if (queueName === undefined || queueName === (animation.queue ?? animation.options?.queue ?? defaultQueue)) {
		if (!(animation._flags & AnimationFlags.STARTED)) { // tslint:disable-line:no-bitwise
			// Copied from tick.ts - ensure that the animation is completely
			// valid and run begin() before complete().
			const options = animation.options!;

			// The begin callback is fired once per call, not once per
			// element, and is passed the full raw DOM element set as both
			// its context and its first argument.
			if (options._started!++ === 0) {
				options._first = animation;
				if (options.begin) {
					// Pass to an external fn with a try/catch block for optimisation
					beginCall(animation);
					// Only called once, even if reversed or repeated
					options.begin = undefined;
				}
			}
			animation._flags |= AnimationFlags.STARTED; // tslint:disable-line:no-bitwise
		}
		// tslint:disable-next-line:forin
		for (const property in animation.tweens) {
			const tween = animation.tweens[property];
			const sequence = tween.sequence!;
			const pattern = sequence.pattern;
			let currentValue = "";
			let i = 0;

			if (pattern) {
				const endValues = sequence[sequence.length - 1];

				for (; i < pattern.length; i++) {
					const endValue = endValues[i];

					currentValue += endValue == null ? pattern[i] : endValue;
				}
			}
			setPropertyValue(animation.element!, property, currentValue, tween.fn);
		}
		completeCall(animation);
	}
}

/**
 * When the finish action is triggered, the elements' currently active call is
 * immediately finished. When an element is finished, the next item in its
 * animation queue is immediately triggered. If passed via a chained call
 * then this will only target the animations in that call, and not the
 * elements linked to it.
 *
 * A queue name may be passed in to specify that only animations on the
 * named queue are finished. The default queue is named "". In addition the
 * value of `false` is allowed for the queue name.
 *
 * An final argument may be passed in to clear an element's remaining queued
 * calls. This may only be the value `true`.
 */
function finish(this: IActionThis, maybeQueueName?: string | boolean, finishAll?: boolean): void {
	const queueName = validateQueue(maybeQueueName, true);
	const { elements, promiseHandler } = this;
	const defaultQueue: false | string = defaults.queue;

	if (!elements || !elements.length) {
		return; // Nothing to do here!
	}
	if (maybeQueueName === true) {
		finishAll = true;
	}
	if (isAnimation(elements) && elements.velocity.animations) {
		for (const animation of elements.velocity.animations) {
			checkAnimationShouldBeFinished(animation, queueName, defaultQueue);
		}
	} else {
		while (State.firstNew) {
			validateTweens(State.firstNew);
		}
		for (let activeCall = State.first, nextCall: AnimationCall | undefined;
			activeCall && (finishAll || activeCall !== State.firstNew);
			activeCall = nextCall ?? State.firstNew
		) {
			nextCall = activeCall._next;
			if (!elements || elements.includes(activeCall.element as any)) {
				checkAnimationShouldBeFinished(activeCall, queueName, defaultQueue);
			}
		}
	}
	if (promiseHandler) {
		if (isAnimation(elements) && elements.velocity.animations && elements.then) {
			elements.then(promiseHandler._resolver);
		} else if (promiseHandler._resolver) {
			promiseHandler._resolver(elements);
		}
	}
}

registerAction("finish", finish, true, true);

declare module "../velocity" {
	export interface IVelocity {
		/**
		 * Finish the running animations on the elements selected.
		 *
		 * @param elements An `Element`, or an array-like list of `Elements` to
		 * process.
		 * @param queue The queue to finish.
		 * @param finishAll Should this stop all queued animations too?
		 */
		(elements: KnownElement, action: "finish", queue?: string | false, finishAll?: true): IAnimation;
		(this: IActionThis, action: "finish", queue?: string | false, finishAll?: true): IAnimation;

		/**
		 * Finish the running animations on the elements selected.
		 *
		 * @param elements An `Element`, or an array-like list of `Elements` to
		 * process.
		 * @param finishAll Should this stop all queued animations too?
		 */
		(elements: KnownElement, action: "finish", finishAll?: true): IAnimation;
		(this: IActionThis, action: "finish", finishAll?: true): IAnimation;

		/**
		 * Finish any running animations.
		 *
		 * @param queue The queue to finish.
		 * @param finishAll Should this stop all queued animations too?
		 */
		(action: "finish", queue?: string | false, finishAll?: true): IAnimation;

		/**
		 * Finish any running animations.
		 *
		 * @param finishAll Should this stop all queued animations too?
		 */
		(action: "finish", finishAll?: true): IAnimation;
	}
}
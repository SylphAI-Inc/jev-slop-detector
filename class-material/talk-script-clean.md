# Talk script — AdaL Autonomy Deck (2026-09-25)

Cleaned from the live transcript. Spoken voice kept; only obvious speech-recognition errors fixed. Sections match the 15 deck slides.

---

## Slide 1 — When the sun goes down, does your work still go on?

Hi. Hello.

When the sun goes down, does your work still go on?

Today we're going to explore the future of agent autonomy. The topic goes from loop and graph engineering to Jev.

Hello everyone, good morning. My name is Li Yin. I'm the cofounder and the CEO of AdaL.

## Slide 2 — What AdaL is

We started as a coding agent, and along the way we started to use the coding agent to do anything else. Including preparing our product updates. We go from directly changelog to product updates email and product updates blog, and we also make product update videos directly.

We launched the AdaL course, and we use AdaL video directly to edit and use AI to deal with video. We do animated product demo videos at the same time.

AdaL sometimes operates itself — it operates the browser to record and make videos.

And we found this is something wonderful. Like many other startups like us, we also use the browser to do social reach-outs, to be in contact.

Every coding agent can build, but only AdaL does GTM directly from your codebase.

## Slide 3 — Demo: idea to GTM

So let's see how it works. Here's a demo about us. Well, look at the demo later.

## Slide 4 — The babysitting paradox

Today, every single company is either talking about tokenmaxxing, and they'll get surprised — currently people are spending 2K to 8K per person. Engineering teams are already spending upwards of 2K to 5K a month per developer on tokens alone. So projections show AI coding costs overtaking developer salaries by 2028.

I wouldn't say agent tokenmaxxing is the direction we should go. It's more agentmaxxing. But you might find agent works faster, you feel like more productive — but in reality... you'll learn this soon enough.

Building something faster — quick, a demo, fixing a bug. For example, in the codebase, you might create a feature very quick, you might fix the bug really quick. What you can often find — you won't be surprised about this one — is you'll have a lot of weird bugs. This is where the humans sometimes move just too fast, and when their understanding didn't catch up with the speed of the agent's working.

There's just — in real production there's just so many different states in a real design you just need to cover every single thing we know. On one side, and even that might be the result when your developers are actually trying their best to actually keep an eye on the agent's work, review every single thing.

## Slide 5 — What human quality work actually takes

To go beyond to autonomy, we really have to go beyond. The human working quality is... not just you have the model intelligence and we wrap it in a for loop of the agent going tools, using files, browser runtime — you got the agent and the harness. And the humans actually run a development process. For example, in the development process you actually run the outer loop proactively: you understand, you plan, build and test, and review, and then only then you can deliver, right.

This process right now is mainly driven by humans along with agents. And sometimes we feel okay, maybe it's really faster.

## Slide 6 — Five gaps

We identified five gaps for us to actually approach autonomy.

First, as you can see, it's the complicated process. You do want an agent to be able to handle the outer loop. You might want it to do the plan and the understand. In the testing stage it might have to drive the browser if you are building a web app, or drive the terminal when we're building a terminal agent. And then you need a human and AI coding review, which is the best when they don't have a contaminated context. So it's best you actually use a separate reviewer to identify gaps. But even that, they sometimes just don't catch something — sometimes it's fundamentally about your design.

So it requires the humans to operate a complicated process. And the second thing is you need the browser use. You need a human-level of capability. Sometimes it depends on what you're trying to build — you need it to actually see the image, see the visuals, listen to the audio if you're actually building an audio app, and afterwards.

The third gap is really... the expert-level skill for the work.

That happens the most when we humans are trying to build the design architecture, and thinking how the code could potentially be good code. You can think about this as a way: if you just use test-driven, and you have a feature requirement today, there might be 100 solutions that pass all your tests. But there might be just a few of them that are actually good design — because it's always simpler, less likely to cause bugs.

And this is about the human explainable knowledge. This level of knowledge you are going to need in every single stage — in the planning, in the testing. In the testing you need to know, okay, how do I use Playwright, or maybe a particular testing tool, to actually automate the test. That is achieving a really expert level.

The fourth is the context of the project. Coding agents don't really have it — they can just write the code. You give them a goal, they can try to achieve the goal. But actually along the way they need to make sure they have the context of the project, and they understand how the project is organized. The longer context of the project is not really...

The fifth is the memory of the humans. What we have tried last month, what failed, what we promised the customers — decisions. Those are the decisions that are currently living in people's heads, and not really in any file. And also human memory really decides if you're actually going to like this project or not.

A lot of the times we are here to review purely because our long-term memory remembers — oh, if we do it this way, it's very likely to create a bug. For example, you might have chosen a certain way to build the product in a certain way, but the agent actually doesn't know that. Then the next time you ask it to fix a bug, it ends up rewriting the whole codebase, or it just ends up rewriting the whole feature. Those are the kinds of stuff where memory is really important.

## Slide 7 — Where AdaL stands

But today we're not going to cover everything about autonomy. It's more about the first thing — the process. How can we make sure the agent can complete the complicated process.

## Slide 8 — Modeling: LLMs vs Jev

And the first thing we want to introduce — everyone already knows the LLM, which takes a text sequence as the input. Jev also got a text sequence as the input. Then the output. The LLM is where you can get the complicated function tool call.

## Slide 9 — The planner and the judge

## Slide 10 — What Jev returns

In the Jev case, the output — the input is state, which could be the context or anything, and a question. So it's fundamentally a classification problem. Their API supports it but we don't necessarily know their model architecture — at this point we really don't know their model architecture.

## Slide 11 — Loop engineering: work until the goal is achieved

A lot of the times, humans are actually here only making yes and no judgments. So this is like the first thing that we might do to stop the babysitting in some way — can we actually copy the human judgment? While we were using this babysitting, would the agent be able to take away some of it?

In reality we found: in the agent, when the call to the tools happens — this is across models — they often say "I'm gonna call the tools" but they don't really call it. That could be potentially 10%. And Jev is really good at catching it, because it's so fast — 200 times faster and 400 times cheaper — that makes its cost almost non-existent, so you're able to do it on every single output in the agent.

And the second is, instead of... we can delegate the permission handling to something more superficial, because most of the time your agent is designed to be more secure from the tuning layer. That's why we have to run babysitting — it's designed at the tool level, not really at the level of agency we want. We need to go further. Maybe Jev is gonna take that kind of human judgment. So when there's a premature stop, you could just tell them to continue. When it asks you about permission, they can just say yes, let's go.

And when you say it's a tool — go achieve — I think they can't really replace you yet as someone who can respond, because that's only what an LLM can do, even if it didn't achieve the goal. You still [judge] — how does the planning look like, is it good or not good.

In this case, loop engineering is really: you just want your agent to work until the goal is achieved, without actually prompting along the process. That is the simplest way we could put loop engineering.

## Slide 12 — Graph engineering: big jobs need more than one worker

You can think about Claude Code — they already have the Claude Code workflow. And the teams' dynamic workflow — the teams all kind of have a swarm of agents. So graph engineering is more in the domain of multi-agent.

## Slide 13 — AdaL Engineer

This is when your job might be more complicated and needs more than one worker, because of the context. We are gonna show you a little bit later about a more complicated task, and why actually using separate workers is gonna [be] better. But we didn't really go for an approach like Claude Code's dynamic workflow — it's unnecessarily complicated, I would say, every single time. And not as flexible. Another dimension: you have the agent teams, but they can't really create a dynamic [role] — the role itself you kind of have to pre-configure. Also a lot less flexible.

So in AdaL we are experimenting with something called the AdaL Engineer.

You are able to automate ways with one worker, and this is often very very possible in one single session. But still, sometimes you need different models, so you definitely have to split into multiple workers. In AdaL you have the ability to switch models anytime in the session. But still, I wouldn't say it's super clean. There's something more interesting going on there, or we might potentially explore — maybe Jev could be doing model routing.

The way you really think about AdaL Engineer is how you are using the coding agent, and how you're navigating multiple coding agents to solve one complicated task.

Here's one example. You can say the goal is to actually clone a landing page, which is quite complicated. And the best way to do that is to actually have multiple workers. One is really focusing on getting it done — reverse-engineering the landing page. And the other one is really on... collecting the dots on the product side, and collecting the dots on the marketing side.

## Slide 14 — The world is a complicated, many-layered loop

## Slide 15 — Closing: adalagent.ai

At the end, the QR code — we want to get people. For the first 20 people scanning, you get 1 month free of AdaL.

AdaL makes work and life a little lighter.

---

Promo: code `JEVTALK1MO` — https://adal.sylph.ai/subscription?tier=pro&promo=JEVTALK1MO

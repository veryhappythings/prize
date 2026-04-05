# PR Review Tool

A tool for making human review of PRs easy. The goal is not to replace human reviews, but instead to augment and structure them

## Usage

- Run it from the command line with a github PR URL. It produces a static HTML site, runs a webserver to serve it and opens it in your browser

## How it works

1. Use the github API to pull basic stats about the PR
2. Use the github API to pull all the changes of the PR
3. Use an LLM to analyse it
4. present findings as a series of slides, describing the PR in stages

## Slide design

- during the analysis, figure out a logical set of pieces that make up the PR. These pieces will be displayed one by one in order in a sort of slide show
- start with a high level overview of the feature, including details from the attached jira ticket if available. Use the 4C model to situate the code
- consider UML diagrams, if they would be useful in understanding the code
- the user will be able to work through the pieces in order. The aim is, at the end of it, they understand the PR
- slides will initially summarise large code changes and just display method signatures. Then they will dive in. Eventually, the user will see all code in the PR
- incorporate agent feedback into the slides

## Tech details
- Cache findings step by step in ~/.pr-deck
